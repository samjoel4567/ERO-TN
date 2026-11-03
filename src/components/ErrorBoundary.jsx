import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('PALS ErrorBoundary caught an unhandled rendering error:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-8 max-w-xl mx-auto my-12 bg-white border border-critical-200 rounded-2xl shadow-sm text-stone-900">
          <div className="flex items-center gap-3 text-critical-700 font-bold text-lg mb-2">
            <AlertTriangle className="w-6 h-6 text-critical-600 shrink-0" />
            <span>Simulation Display Error</span>
          </div>
          <p className="text-sm text-stone-600 mb-4">
            An unexpected error occurred while rendering the map or mission display. The system state has been preserved.
          </p>
          <div className="p-3 bg-critical-50 rounded-lg text-xs font-mono text-critical-900 border border-critical-200 break-words mb-5">
            {this.state.error?.message || 'Unknown error'}
          </div>
          <div className="flex gap-3">
            <button
              onClick={this.handleReset}
              className="px-4 py-2 bg-burnt-600 hover:bg-burnt-500 text-white rounded-lg text-xs font-semibold flex items-center gap-2 transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Retry Rendering</span>
            </button>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-lg text-xs font-semibold transition-colors"
            >
              Reload Page
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

