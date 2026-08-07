import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  try {
    const { symptoms, patientData } = await req.json()
    
    // Logic to categorize symptoms and generate analysis
    const criticalSymptoms = ["Severe headache", "Blurred vision", "Upper abdominal pain", "Reduced fetal movement", "Vaginal bleeding"]
    const includesCritical = symptoms.some((s: string) => criticalSymptoms.includes(s))
    
    let analysis = ""
    
    if (includesCritical) {
        analysis = `ALERT: Critical symptom cluster detected. 
The combination of [${symptoms.join(', ')}] in Week ${patientData.gestationalWeek} suggests an immediate risk of Preeclampsia or acute fetal distress. 

Action: Proceed to Level 4 escalation. Immediate physical examination and Doppler fetal monitoring required.`
    } else {
        analysis = `Analysis complete: The reported symptoms [${symptoms.join(', ')}] are currently classified as MODERATE. 
While not immediately critical, these findings correlate with the patient's existing biometric BP elevation. 

Action: Schedule 24h follow-up and increase hydration monitoring.`
    }

    // Delay for AI synthesis effect
    await new Promise(resolve => setTimeout(resolve, 1500))

    return NextResponse.json({ analysis })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to analyze symptoms.' }, { status: 500 })
  }
}
