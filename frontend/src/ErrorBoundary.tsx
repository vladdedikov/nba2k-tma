import { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-screen bg-[#181818] p-6 text-center text-white">
          <div className="text-4xl mb-4">⚠️</div>
          <h1 className="text-xl font-bold text-[#ff3b30] mb-2">Что-то пошло не так</h1>
          <p className="text-[#8e8e93] text-sm mb-4">
            Произошла ошибка при рендеринге интерфейса.
          </p>
          <pre className="bg-[#212121] p-3 rounded-lg text-left text-[11px] text-[#ff9f0a] overflow-x-auto w-full max-w-md border border-[#303030]">
            {this.state.error?.toString()}
          </pre>
          <button 
            onClick={() => window.location.reload()}
            className="mt-6 px-5 py-2.5 bg-[#3390ec] rounded-xl font-bold text-sm hover:bg-[#2b7bc4] transition-colors"
          >
            Перезагрузить страницу
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
