import { Component, type ErrorInfo, type ReactNode } from 'react'
import { ErrorState } from '@/components/ErrorState'

type Props = { children: ReactNode }
type State = { error: Error | null }

// Contains a render crash to the route that threw, instead of blanking the whole app.
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Render error', error, info.componentStack)
  }

  render() {
    if (this.state.error) {
      return (
        <ErrorState
          title="Something broke on this page"
          error={{ detail: 'Reload to try again. If it keeps happening, let the NORTHSTAR team know.' }}
          onRetry={() => window.location.reload()}
        />
      )
    }
    return this.props.children
  }
}
