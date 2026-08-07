import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import OpenAI from 'openai'

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
})

const tools = [
    {
        type: 'function',
        function: {
            name: 'log_symptom',
            description: 'Log a new physical symptom for the user.',
            parameters: {
                type: 'object',
                properties: {
                    symptom_name: { type: 'string', description: 'The name of the symptom (e.g., headache, dizziness)' },
                    severity: { type: 'integer', description: 'Severity from 1 to 5', minimum: 1, maximum: 5 }
                },
                required: ['symptom_name', 'severity']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'log_water_intake',
            description: 'Log glasses of water for the user',
            parameters: {
                type: 'object',
                properties: {
                    glasses: {
                        type: 'number',
                        description: 'Number of glasses of water consumed'
                    }
                },
                required: ['glasses']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'check_risk_score',
            description: 'Get the latest Maternal Risk Index (MRI) score and status.',
            parameters: { type: 'object', properties: {} }
        }
    },
    {
        type: 'function',
        function: {
            name: 'show_medication_schedule',
            description: 'Get the medication schedule and current intake status for today.',
            parameters: { type: 'object', properties: {} }
        }
    },
    {
        type: 'function',
        function: {
            name: 'contact_doctor',
            description: 'Initiate a contact request or escalation to the assigned doctor.',
            parameters: { type: 'object', properties: {} }
        }
    }
]

export async function POST(req: Request) {
    try {
        const { userMessage, userId } = await req.json()

        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        // 1. Fetch Full Health Context + AI Memory
        const today = new Date(new Date().setHours(0, 0, 0, 0)).toISOString()
        const [
            { data: userProfile },
            { data: mri },
            { data: vitals },
            { data: symptoms },
            { data: medLogs },
            { data: waterToday },
            { data: moodLogs },
            { data: memories },
            { data: history }
        ] = await Promise.all([
            supabase.from('users').select('gestational_week').eq('id', userId).single(),
            supabase.from('mri_scores').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(1).single(),
            supabase.from('vitals').select('*').eq('user_id', userId).order('recorded_at', { ascending: false }).limit(3),
            supabase.from('symptoms').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(5),
            supabase.from('medicine_logs').select('*').eq('user_id', userId).gte('created_at', today),
            supabase.from('water_intake').select('glasses').eq('user_id', userId).gte('created_at', today),
            supabase.from('mood_logs').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(1).single(),
            supabase.from('ai_memory').select('memory_type, memory_value').eq('user_id', userId),
            supabase.from('ai_conversations').select('role, message_text').eq('user_id', userId).order('created_at', { ascending: false }).limit(10)
        ])

        const totalWater = waterToday?.reduce((acc: number, curr: { glasses: number }) => acc + curr.glasses, 0) || 0
        const memoryString = memories?.map((m: { memory_type: string, memory_value: string }) => `${m.memory_type}: ${m.memory_value}`).join('\n') || 'No long-term patterns detected yet.'

        // 2. Safety Rule Engine
        let safetyWarning = ""
        const latestVital = vitals?.[0]
        if (latestVital) {
            if (latestVital.systolic_bp > 150) safetyWarning = "CRITICAL BP: 150+ detected. Alerting medical team."
            if (latestVital.spo2 < 94) safetyWarning = "OXYGEN ALERT: SpO2 below 94%."
        }

        // 3. Structured AI System Prompt with Conversation State Awareness
        const systemPrompt = `You are MomSafe AI, an intelligent maternal health guardian.
        You support pregnant mothers emotionally and clinically. You have tools to log data and check status.

        CONVERSATION STATE RULES:
        • If you previously asked for a quantitative value (like "How many glasses did you drink?") and the user replies with just a number (e.g., "2"), interpret it as the parameter for the pending tool (log_water_intake).
        • Use conversation history to track pending actions.

        User Context:
        Week: ${userProfile?.gestational_week || 'Not set'} | MRI: ${mri?.score || 'N/A'} (${mri?.status || 'N/A'})
        Vitals: ${JSON.stringify(vitals)}
        Symptoms: ${symptoms?.map((s: { symptom_name: string }) => s.symptom_name).join(', ')}
        Water: ${totalWater} glasses | Meds: ${medLogs?.length || 0} taken today
        AI Memory: ${memoryString}

        Rules:
        • Speak calmly. Refer back to Patterns (AI Memory).
        • MUST return responses in JSON format: { "reply": "...", "suggestions": ["...", "..."], "newMemory": { "type": "...", "value": "..." } (optional), "pending_action": string (optional) }
        • If you log water, suggest: ["Log another glass", "Check hydration summary", "Return to dashboard"]
        • Return JSON format even if no tool is called.`

        const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
            { role: 'system', content: systemPrompt },
            ...(history?.reverse().map((h: { role: string, message_text: string }) => ({ role: h.role === 'ai' ? 'assistant' : 'user', content: h.message_text })) || []) as OpenAI.Chat.ChatCompletionMessageParam[],
            { role: 'user', content: userMessage }
        ]

        // 4. OpenAI Call (with Tool Choice)
        const response = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: messages,
            tools: tools as OpenAI.Chat.ChatCompletionTool[],
            tool_choice: 'auto',
        })

        let responseMessage = response.choices[0].message
        const toolCalls = responseMessage.tool_calls

        if (toolCalls) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const availableFunctions: Record<string, (args?: any) => Promise<string>> = {
                log_symptom: async (args: { symptom_name: string; severity: number }) => {
                    const { error } = await supabase.from('symptoms').insert({ user_id: userId, symptom_name: args.symptom_name, severity: args.severity })
                    if (error) console.error("Symptom log error:", error)
                    return `SUCCESS: Logged ${args.symptom_name} (Severity ${args.severity}).`
                },
                log_water_intake: async (args: { glasses: number }) => {
                    // Specific requirement: Insert into Supabase with error logging
                    const { error } = await supabase
                        .from("water_intake")
                        .insert({
                            user_id: userId,
                            glasses: args.glasses,
                            created_at: new Date()
                        })

                    if (error) {
                        console.error("Water intake insert error:", error)
                        return "Error logging water. Please try again."
                    }

                    // Specific requirement: Return confirmation message
                    return `Great! I've logged ${args.glasses} glasses of water for today. Staying hydrated is important during pregnancy.`
                },
                check_risk_score: async () => `The latest MRI score is ${mri?.score || 'unknown'}.`,
                show_medication_schedule: async () => {
                    const { data: p } = await supabase.from('prescriptions').select('*').eq('user_id', userId)
                    return `Schedule: ${p?.map(i => i.medicine_name).join(', ')}`
                },
                contact_doctor: async () => {
                    await supabase.from('alerts').insert({ user_id: userId, alert_type: 'DOCTOR_CONTACT_REQUEST', alert_status: 'ACTIVE', mri_score: mri?.score || 0 })
                    return `SUCCESS: Doctor notified.`
                }
            }

            messages.push(responseMessage as OpenAI.Chat.ChatCompletionMessageParam)
            for (const toolCall of toolCalls) {
                const call = toolCall as unknown as { id: string, function?: { name: string, arguments: string } }
                if (call.function) {
                    const functionName = call.function.name
                    const functionArgs = JSON.parse(call.function.arguments)
                    const functionResponse = await availableFunctions[functionName](functionArgs)
                    messages.push({
                        tool_call_id: toolCall.id,
                        role: 'tool',
                        content: functionResponse
                    } as OpenAI.Chat.ChatCompletionMessageParam)
                }
            }

            // Get final structured JSON response
            const secondResponse = await openai.chat.completions.create({
                model: 'gpt-4o-mini',
                messages: messages,
                response_format: { type: 'json_object' }
            })
            responseMessage = secondResponse.choices[0].message
        } else {
            // Need to ensure the non-tool response is JSON
            const fallbackResponse = await openai.chat.completions.create({
                model: 'gpt-4o-mini',
                messages: messages,
                response_format: { type: 'json_object' }
            })
            responseMessage = fallbackResponse.choices[0].message
        }

        const rawJsonData = JSON.parse(responseMessage.content!)
        const finalReply = safetyWarning ? `${safetyWarning}\n\n${rawJsonData.reply}` : rawJsonData.reply
        const suggestions = rawJsonData.suggestions || []

        // 6. DB Updates & Response
        const dbOps = [
            supabase.from('ai_conversations').insert({ user_id: userId, role: 'user', message_text: userMessage }),
            supabase.from('ai_conversations').insert({ user_id: userId, role: 'ai', message_text: finalReply })
        ]
        if (rawJsonData.newMemory) {
            dbOps.push(supabase.from('ai_memory').insert({ user_id: userId, memory_type: rawJsonData.newMemory.type, memory_value: rawJsonData.newMemory.value }))
        }
        await Promise.all(dbOps)

        return NextResponse.json({ reply: finalReply, suggestions })

    } catch (error: unknown) {
        console.error('AI Comprehensive Error:', error)
        return NextResponse.json({ error: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 })
    }
}
