// Redirect to the callback UI page.
// With implicit flow, the token is in the URL hash (#access_token=...)
// which is handled client-side by /auth/callback/page.tsx.
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const error = searchParams.get('error_description') ?? searchParams.get('error')

  if (error) {
    const url = new URL(`${origin}/auth/callback`)
    url.searchParams.set('error', error)
    return NextResponse.redirect(url)
  }

  // Pass through to callback page — hash fragment is preserved by the browser
  return NextResponse.redirect(`${origin}/auth/callback`)
}
