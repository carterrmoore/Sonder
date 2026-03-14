'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const C = {
  bg: '#f5f0e8',
  border: '#ccc8bc',
  text: '#1a1a18',
  textFaint: '#8a8a82',
  gold: '#8a6a1a',
  amber: '#7a4a10',
  amberBg: '#f0e8d8',
  amberBorder: '#d0b890',
}

type Props = {
  checkBadge: number
  articlesBadge: number
}

export default function CuratorNav({ checkBadge, articlesBadge }: Props) {
  const pathname = usePathname()

  const tabs = [
    { href: '/curator', label: 'Overview', badge: 0, exact: true },
    { href: '/curator/check', label: 'Check', badge: checkBadge, exact: false },
    { href: '/curator/articles', label: 'Articles', badge: articlesBadge, exact: false },
    { href: '/curator/signoff', label: 'Sign-off', badge: 0, exact: false },
  ]

  return (
    <nav
      className="border-b flex items-center px-6 flex-shrink-0"
      style={{ borderColor: C.border, background: C.bg, height: '40px' }}
    >
      <span
        className="text-sm tracking-widest uppercase font-['system-ui'] font-light mr-5"
        style={{ color: C.text }}
      >
        Sonder
      </span>
      <span className="text-sm mr-5" style={{ color: C.border }}>|</span>

      {tabs.map(tab => {
        const isActive = tab.exact
          ? pathname === tab.href
          : pathname.startsWith(tab.href)

        return (
          <Link
            key={tab.href}
            href={tab.href}
            className="flex items-center gap-1.5 px-4 h-full border-b-2 text-sm font-['system-ui'] transition-colors hover:opacity-80"
            style={
              isActive
                ? { borderColor: C.gold, color: C.text }
                : { borderColor: 'transparent', color: C.textFaint }
            }
          >
            {tab.label}
            {tab.badge > 0 && (
              <span
                className="text-xs px-1.5 py-px min-w-[1.25rem] text-center"
                style={{
                  background: C.amberBg,
                  color: C.amber,
                  border: `1px solid ${C.amberBorder}`,
                }}
              >
                {tab.badge}
              </span>
            )}
          </Link>
        )
      })}
    </nav>
  )
}
