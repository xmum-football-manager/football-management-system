import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

const ROOT_DOMAIN = process.env.NEXT_PUBLIC_ROOT_DOMAIN || 'localhost'

export async function proxy(request: NextRequest) {
  const url = request.nextUrl
  const hostname = request.headers.get('host') || ''

  // Strip port for comparison
  const host = hostname.split(':')[0]

  let surface: 'admin' | 'score' | 'public' = 'public'

  if (host === `admin.${ROOT_DOMAIN}` || url.pathname.startsWith('/admin')) {
    surface = 'admin'
  } else if (host === `score.${ROOT_DOMAIN}` || url.pathname.startsWith('/score')) {
    surface = 'score'
  }

  // Rewrite subdomains to route groups
  if (host === `admin.${ROOT_DOMAIN}`) {
    const path = url.pathname === '/' ? '/admin' : `/admin${url.pathname}`
    return NextResponse.rewrite(new URL(path + url.search, request.url))
  }

  if (host === `score.${ROOT_DOMAIN}`) {
    const path = url.pathname === '/' ? '/score' : `/score${url.pathname}`
    return NextResponse.rewrite(new URL(path + url.search, request.url))
  }

  // Auth guard for admin and score surfaces on subdomain paths
  if (surface !== 'public') {
    // Skip auth check for login page itself
    const isLoginPath =
      url.pathname.endsWith('/login')

    if (!isLoginPath) {
      const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          cookies: {
            getAll() {
              return request.cookies.getAll()
            },
            setAll(cookiesToSet) {
              cookiesToSet.forEach(({ name, value, options }) =>
                request.cookies.set(name, value)
              )
            },
          },
        }
      )

      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        const loginUrl = new URL('/login', request.url)
        loginUrl.searchParams.set('redirectTo', url.pathname)
        return NextResponse.redirect(loginUrl)
      }
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|manifest.json|sw.js|workbox-.*\\.js).*)',
  ],
}
