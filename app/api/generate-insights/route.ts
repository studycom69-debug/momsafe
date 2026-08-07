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

export async function POST(req: Request) {
    try {
        const { userId } = await req.json()

        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        // 1. Fetch relevant data for insight generation
        const [
            { data: mriHistory },
            { data: waterToday },
            { data: medLogs },
            { data: symptoms },
            { data: existingInsights }
        ] = await Promise.all([
            supabase.from('mri_scores').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(5),
            supabase.from('water_intake').select('glasses').eq('user_id', userId).gte('created_at', new Date(new Date().setHours(0, 0, 0, 0)).toISOString()),
            supabase.from('medicine_logs').select('*').eq('user_id', userId).gte('created_at', new Date(new Date().setHours(0, 0, 0, 0)).toISOString()),
            supabase.from('symptoms').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(5),
            supabase.from('ai_insights').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(1)
        ])

        // Check if we already generated an insight in the last hour to avoid spamming/token waste
        if (existingInsights && existingInsights.length > 0) {
            const lastInsightTime = new Date(existingInsights[0].created_at).getTime()
            const oneHourAgo = new Date().getTime() - (60 * 60 * 1000)
            if (lastInsightTime > oneHourAgo) {
                return NextResponse.json({ insight: existingInsights[0] })
            }
        }

        const totalWater = waterToday?.reduce((acc: number, curr: { glasses: number }) => acc + curr.glasses, 0) || 0

        // 2. Generate Insight via AI
        const systemPrompt = `You are the MomSafe AI Health Analyzer. 
    Analyze the following data and generate a SINGLE, highly personalized, proactive health insight for a pregnant mother.
    
    Data:
    - MRI Scores (last 5): ${JSON.stringify(mriHistory)}
    - Water intake today: ${totalWater} glasses
    - Medication doses taken today: ${medLogs?.length || 0}
    - Recent symptoms: ${symptoms?.map((s: { symptom_name: string }) => s.symptom_name).join(', ')}

    Rules:
    - Be concise (max 20 words).
    - Be supportive but clinically aware.
    - Pick the MOST important thing to mention (e.g. low water, rising risk, missing medication, or positive reinforcement).
    - Output JSON: { "message": "...", "type": "hydration" | "risk" | "medication" | "symptom" | "general" }`

        const completion = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [{ role: 'system', content: systemPrompt }],
            response_format: { type: 'json_object' }
        })

        const rawInsight = JSON.parse(completion.choices[0].message.content!)

        // 3. Store Insight
        const { data: newInsight, error: insertError } = await supabase
            .from('ai_insights')
            .insert({
                user_id: userId,
                message: rawInsight.message,
                type: rawInsight.type
            })
            .select()
            .single()

        if (insertError) throw insertError

        return NextResponse.json({ insight: newInsight })

    } catch (error: unknown) {
        console.error('Insight Generator Error:', error)
        return NextResponse.json({ error: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 })
    }
}
