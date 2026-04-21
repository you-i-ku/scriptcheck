import { Component, type ErrorInfo, type ReactNode } from 'react';

type State = {
  error: Error | null;
  info: ErrorInfo | null;
};

export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null, info: null };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    this.setState({ info });
    console.error('[ErrorBoundary caught]', error, info);
  }

  reset = () => this.setState({ error: null, info: null });

  clearStorageAndReload = () => {
    try {
      localStorage.clear();
      if (window.indexedDB) {
        const req = indexedDB.deleteDatabase('srt-editor');
        req.onsuccess = () => location.reload();
        req.onerror = () => location.reload();
        setTimeout(() => location.reload(), 500);
      } else {
        location.reload();
      }
    } catch {
      location.reload();
    }
  };

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="error-boundary">
        <h2>エラーで画面が止まってしまった…</h2>
        <p className="err-msg">{this.state.error.message}</p>
        <details>
          <summary>スタックトレース(コピーしてopusくんに送って)</summary>
          <pre>{this.state.error.stack}</pre>
          {this.state.info && <pre>{this.state.info.componentStack}</pre>}
        </details>
        <div className="err-actions">
          <button onClick={this.reset}>画面を再描画(軽微な場合)</button>
          <button onClick={() => location.reload()}>ページリロード</button>
          <button className="danger" onClick={this.clearStorageAndReload}>
            永続データ削除してリロード(最終手段)
          </button>
        </div>
        <p className="err-hint">
          「最終手段」ボタンは保存済みセッション・設定を全部削除してリセットする。
          毎回同じ所でクラッシュする場合、これで直ることが多い。
        </p>
      </div>
    );
  }
}
