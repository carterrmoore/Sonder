'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleLogin() {
    if (!email) return
    setLoading(true)
    const supabase = createClient()
    await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    })
    setSubmitted(true)
    setLoading(false)
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#1a1a1a]">
        <div className="text-center">
          <p className="text-[#f5f0e8] text-lg">Check your email.</p>
          <p className="text-[#888] text-sm mt-2">
            A sign-in link has been sent to {email}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#1a1a1a]">
      <div className="w-full max-w-sm space-y-4">
        <p className="text-[#f5f0e8] text-sm font-medium">Sonder — Curator Access</p>
        <input
          type="email"
          placeholder="your@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
          className="w-full px-4 py-3 bg-[#2a2a2a] border border-[#333] rounded text-[#f5f0e8] placeholder-[#555] focus:outline-none focus:border-[#888] text-sm"
        />
        <button
          onClick={handleLogin}
          disabled={loading || !email}
          className="w-full px-4 py-3 bg-[#f5f0e8] text-[#1a1a1a] rounded text-sm font-medium disabled:opacity-40 hover:bg-white transition-colors"
        >
          {loading ? 'Sending...' : 'Send sign-in link'}
        </button>
      </div>
    </div>
  )
}
