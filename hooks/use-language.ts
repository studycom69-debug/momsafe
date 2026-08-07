"use client"

import { useState } from 'react'

export function useLanguage() {
  const [language, setLanguage] = useState<'en' | 'hi'>('en')
  return { language, setLanguage }
}
