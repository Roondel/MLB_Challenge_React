import { Component } from 'react';
import { RefreshCw } from 'lucide-react';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('App error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-dark-900 flex items-center justify-center p-8">
          <div className="max-w-md text-center">
            <div className="w-16 h-16 rounded-full bg-dark-800 border border-dark-600 flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl">⚾</span>
            </div>
            <h1 className="text-xl font-bold mb-2">Something went wrong</h1>
            <p className="text-gray-500 text-sm mb-6">
              The app hit an unexpected error. Your data is safe in localStorage.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-accent hover:bg-accent-hover text-white font-medium rounded-lg transition-colors text-sm"
            >
              <RefreshCw size={16} />
              Reload App
            </button>
            <details className="mt-6 text-left">
              <summary className="text-xs text-gray-600 cursor-pointer hover:text-gray-400">
                Error details
              </summary>
              <pre className="mt-2 p-3 bg-dark-800 rounded-lg text-xs text-red-400 overflow-auto max-h-32 border border-dark-600">
                {this.state.error?.message}
              </pre>
            </details>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
