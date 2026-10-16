import React from "react";

export default class ErrorBoundary extends React.Component {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error, info) {
    console.error("모아 화면 오류", error, info.componentStack);
  }

  render() {
    if (this.state.failed) {
      return (
        <section className="loading" role="alert">
          <h1>화면을 표시하지 못했습니다</h1>
          <p>
            다시 불러와 주세요. 저장된 자산 데이터는 서버에 보관되어 있습니다.
          </p>
          <button className="button primary" onClick={() => location.reload()}>
            다시 불러오기
          </button>
        </section>
      );
    }
    return this.props.children;
  }
}
