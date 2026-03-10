import { createClient } from '@/lib/supabase/server'

export default async function CuratorPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: profile } = await supabase
    .from('users')
    .select('role, display_name')
    .eq('auth_id', user?.id)
    .single()

  return (
    <div className="min-h-screen bg-[#1a1a1a] flex items-center justify-center">
      <div className="text-center space-y-2">
        <p className="text-[#f5f0e8]">Signed in as {profile?.display_name}</p>
        <p className="text-[#888] text-sm">Role: {profile?.role}</p>
        <p className="text-[#888] text-sm">Auth ID: {user?.id}</p>
      </div>
    </div>
  )
}
