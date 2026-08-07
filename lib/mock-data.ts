export interface Patient {
    id: string
    name: string
    gestationalWeek: number
    age: number
    riskLevel: "LOW" | "MODERATE" | "HIGH" | "CRITICAL"
    status: "Escalating" | "Stable" | "Improving"
    trend: "up" | "down" | "neutral"
    trendLabel: string
    region: string
    sparklineData: number[]
    riskScore: number
    lastAlert: string
    aiReason: string
    vitals: {
        heartRate: number
        bloodPressure: string
        spo2: number
        temperature: number
    }
}

export const mockPatients: Patient[] = []

export const mockPatient = mockPatients[0] ?? null
