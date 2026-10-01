'use client'

import posthog from 'posthog-js'
import { PostHogProvider as PHProvider } from 'posthog-js/react'
import { useEffect } from 'react'

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    posthog.init('phc_orqPdY6VgMSyqf2fzDzGMgeA89JEJ84vYtUC6zbZLj3v', {
      api_host: 'https://us.i.posthog.com',
      defaults: '2026-05-30',
      person_profiles: 'identified_only',
      capture_pageview: true,
      capture_pageleave: true,
      autocapture: true,
      session_recording: {
        maskAllInputs: false,
        maskInputOptions: { password: true },
      },
    })
  }, [])
  return <PHProvider client={posthog}>{children}</PHProvider>
}

export { posthog }
