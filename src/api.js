// Resolve against the app directory so reverse proxies can mount it below /.
export function apiUrl(path) {
  return new URL(`api${path}`, document.baseURI).href;
}

export async function api(path, options = {}) {
  let res;
  try {
    res = await fetch(apiUrl(path), {
      ...options,
      signal: options.signal || AbortSignal.timeout(60000),
      headers:
        options.body instanceof FormData
          ? options.headers
          : { "Content-Type": "application/json", ...options.headers },
    });
  } catch (error) {
    if (error.name === "TimeoutError" || error.name === "AbortError") {
      throw new Error(
        "서버 응답 시간이 초과되었습니다. 연결을 확인해 주세요. 저장 중이었다면 기록 목록을 확인한 뒤 다시 시도해 주세요.",
      );
    }
    throw new Error(
      "데이터 서버에 연결할 수 없습니다. 서버 실행 상태와 접속 주소를 확인해 주세요.",
    );
  }
  if (!res.headers.get("content-type")?.includes("application/json")) {
    throw new Error(
      "데이터 서버의 주소가 올바르지 않거나 연결되지 않았습니다. 실행 창이 열려 있는지 확인하고 프로그램을 다시 시작해 주세요.",
    );
  }
  let json;
  try {
    json = await res.json();
  } catch {
    throw new Error(
      "서버 응답을 읽을 수 없습니다. 잠시 후 다시 시도해 주세요.",
    );
  }
  if (!res.ok) {
    throw new Error(
      typeof json.detail === "string"
        ? json.detail
        : "요청을 처리하지 못했습니다. 입력값과 서버 상태를 확인해 주세요.",
    );
  }
  return json;
}
