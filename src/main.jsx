import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  LayoutDashboard,
  Wallet,
  Repeat2,
  ChartNoAxesCombined,
  ArrowDownToLine,
  Plus,
  ArrowUpRight,
  ArrowDownRight,
  ChevronRight,
  ChevronLeft,
  Upload,
  ImagePlus,
  FileSpreadsheet,
  Check,
  X,
  CircleHelp,
  Search,
  Pencil,
  Landmark,
  ArrowRight,
  CalendarDays,
  ShieldCheck,
  Menu,
  Settings2,
  Camera,
  CheckCheck,
  Loader2,
  Trash2,
  RefreshCw,
  Leaf,
  CircleAlert,
  Download,
  FolderArchive,
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import "./styles.css";
import { api, apiUrl } from "./api";
import ErrorBoundary from "./ErrorBoundary";

const money = (n, sign = false) =>
  `${sign && n > 0 ? "+" : ""}${Math.round(n || 0).toLocaleString("ko-KR")}`;
const percent = (n) => `${n > 0 ? "+" : ""}${((n || 0) * 100).toFixed(2)}%`;
const cls = (n) => (n > 0 ? "positive" : n < 0 ? "negative" : "");
const won = (n) => money(n) + "원";
const COLORS = [
  "#2b7963",
  "#8bb8a3",
  "#b3ca81",
  "#c6b69a",
  "#849dab",
  "#cecbbf",
];
const NAV = [
  ["dashboard", LayoutDashboard, "자산 대시보드"],
  ["holdings", Wallet, "보유 자산"],
  ["dca", Repeat2, "DCA 매수 기록"],
  ["history", ChartNoAxesCombined, "자산 변동 기록"],
  ["import", Upload, "데이터 가져오기"],
];
const post = (path, data, method = "POST") =>
  api(path, { method, body: JSON.stringify(data) });
function Badge({ children, tone = "" }) {
  return <span className={"badge " + tone}>{children}</span>;
}
function Button({
  children,
  icon: Icon,
  onClick,
  variant = "",
  disabled = false,
  type = "button",
  ...rest
}) {
  return (
    <button
      type={type}
      className={"button " + variant}
      onClick={onClick}
      disabled={disabled}
      {...rest}
    >
      {Icon && <Icon size={16} />} {children}
    </button>
  );
}
function Empty({ title, children }) {
  return (
    <div className="empty">
      <Leaf size={32} />
      <h3>{title}</h3>
      <p>{children}</p>
    </div>
  );
}
function Field({ label, children, hint }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}
function NumberInput({ value, onChange, ...rest }) {
  return (
    <input
      type="number"
      step="1"
      min="0"
      value={value ?? ""}
      onChange={(e) =>
        onChange(e.target.value === "" ? null : Number(e.target.value))
      }
      {...rest}
    />
  );
}
function Modal({ title, subtitle, onClose, children }) {
  const ref = useRef();
  useEffect(() => {
    const last = document.activeElement;
    ref.current?.focus();
    const handle = (e) => {
      if (e.key === "Escape") onClose();
      if (e.key === "Tab") {
        const els = ref.current.querySelectorAll(
          "button,input,select,textarea,a[href]",
        );
        const first = els[0],
          lastEl = els[els.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          lastEl.focus();
        } else if (!e.shiftKey && document.activeElement === lastEl) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", handle);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handle);
      document.body.style.overflow = "";
      last?.focus();
    };
  }, []);
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <section
        ref={ref}
        tabIndex={-1}
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        <button
          className="icon-button close"
          aria-label="닫기"
          onClick={onClose}
        >
          <X size={21} />
        </button>
        <h2 id="modal-title">{title}</h2>
        {subtitle && <p className="muted">{subtitle}</p>}
        {children}
      </section>
    </div>
  );
}
function AssetIcon({ holding, small = false }) {
  const t = holding?.ticker || "?";
  return (
    <div
      className={
        "asset-icon " +
        (small ? "small " : "") +
        (t === "QLD"
          ? "purple"
          : t === "SGOV"
            ? "sand"
            : holding?.broker === "토스증권"
              ? "blue"
              : "")
      }
    >
      {t.length < 7 ? t.slice(0, 2) : t.slice(0, 1)}
    </div>
  );
}

function App() {
  const [data, setData] = useState(null),
    [page, setPage] = useState("dashboard"),
    [modal, setModal] = useState(null),
    [toast, setToast] = useState(null),
    [error, setError] = useState(""),
    [menu, setMenu] = useState(false),
    [busy, setBusy] = useState(false),
    [period, setPeriod] = useState("3개월"),
    [account, setAccount] = useState("전체 계좌");
  const toastTimer = useRef();
  const notify = (text) => {
    setToast(text);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 4500);
  };
  const reload = async () => {
    const d = await api("/state");
    if (
      !d ||
      !["holdings", "snapshots", "plans", "trades"].every((key) =>
        Array.isArray(d[key]),
      ) ||
      typeof d.today !== "string"
    ) {
      throw new Error(
        "자산 데이터를 불러오지 못했습니다. 서버의 데이터 형식을 확인해 주세요.",
      );
    }
    setData(d);
  };
  useEffect(() => {
    reload().catch((e) => setError(e.message));
    return () => clearTimeout(toastTimer.current);
  }, []);
  const navigate = (p) => {
    setPage(p);
    setMenu(false);
    window.scrollTo(0, 0);
  };
  const perform = async (fn, message, close = true) => {
    setBusy(true);
    try {
      await fn();
      await reload();
      if (close) setModal(null);
      if (message) notify(message);
      return true;
    } catch (e) {
      notify(e.message);
      return false;
    } finally {
      setBusy(false);
    }
  };
  if (!data)
    return (
      <div className="loading">
        <div className="brand-mark">
          <Leaf />
        </div>
        <h2>
          {error
            ? "자산 데이터를 불러오지 못했습니다"
            : "나의 투자를 불러오고 있어요"}
        </h2>
        {error ? (
          <>
            <p>{error}</p>
            <Button onClick={() => location.reload()}>다시 시도</Button>
          </>
        ) : (
          <Loader2 className="spin" />
        )}
      </div>
    );
  const { holdings, plans, trades, snapshots, today } = data;
  const cost = holdings.reduce((a, h) => a + h.cost, 0),
    value = holdings.reduce((a, h) => a + h.value, 0),
    profit = value - cost;
  const latest = snapshots.at(-1),
    daily = latest?.market_change;
  const activePlans = plans.filter((p) => p.active),
    dailyPlan = activePlans.reduce((a, p) => a + p.amount, 0);
  const grouped = holdings.reduce((a, h) => {
    const key =
      h.broker +
      (h.account === "퇴직연금"
        ? " 퇴직연금"
        : ["IRP", "ISA", "연금저축"].includes(h.account)
          ? " 절세계좌"
          : "");
    a[key] = (a[key] || 0) + h.value;
    return a;
  }, {});
  const accounts = Object.entries(grouped).map(([name, value]) => ({
    name,
    value,
  }));
  const doneToday = trades.filter((t) => t.date === today && t.plan_id).length;
  const openSnapshot = (s) => setModal({ type: "snapshot", snapshot: s });
  const goImport = () => {
    navigate("import");
  };
  function renderChart() {
    let points = snapshots;
    if (period !== "전체" && points.length) {
      let d = new Date(points.at(-1).date);
      d.setMonth(d.getMonth() - (period === "1개월" ? 1 : 3));
      points = points.filter((p) => p.date >= d.toISOString().slice(0, 10));
    }
    return (
      <div className="chart-wrap">
        {points.length ? (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={points}
              margin={{ top: 15, right: 8, left: 8, bottom: 0 }}
            >
              <defs>
                <linearGradient id="asset-fill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#31866a" stopOpacity={0.18} />
                  <stop offset="95%" stopColor="#31866a" stopOpacity={0.01} />
                </linearGradient>
              </defs>
              <CartesianGrid
                stroke="#edf0ec"
                strokeDasharray="3 5"
                vertical={false}
              />
              <XAxis
                dataKey="date"
                tickFormatter={(s) => `${Number(s.slice(5, 7))}.${s.slice(8)}`}
                minTickGap={45}
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 11, fill: "#8d9691" }}
                dy={10}
              />
              <YAxis
                tickFormatter={(n) => `${(n / 1e8).toFixed(1)}억`}
                domain={["auto", "auto"]}
                axisLine={false}
                tickLine={false}
                width={46}
                tick={{ fontSize: 11, fill: "#8d9691" }}
              />
              <Tooltip
                content={({ active, payload }) =>
                  active && payload?.length ? (
                    <div className="chart-tooltip">
                      <span>{payload[0].payload.date}</span>
                      <b>{won(payload[0].payload.value)}</b>
                      <small>투자원금 {won(payload[0].payload.cost)}</small>
                    </div>
                  ) : null
                }
              />
              <Area
                isAnimationActive={false}
                name="투자원금"
                type="linear"
                dataKey="cost"
                stroke="#b5bdb5"
                strokeWidth={1.5}
                strokeDasharray="4 4"
                fill="none"
              />
              <Area
                isAnimationActive={false}
                name="평가금액"
                type="linear"
                dataKey="value"
                stroke="#31866a"
                strokeWidth={2.5}
                fill="url(#asset-fill)"
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <Empty title="첫 자산 기록을 남겨보세요">
            평가금액을 기록하면 변화를 차트로 볼 수 있어요.
          </Empty>
        )}
      </div>
    );
  }
  function dashboard() {
    return (
      <>
        <div className="page-heading">
          <div>
            <div className="eyebrow">MY INVESTMENT OVERVIEW</div>
            <h1>차곡차곡, 나의 자산</h1>
            <p>오늘의 기록이 내일의 자산이 됩니다.</p>
          </div>
          <Button variant="primary" icon={Plus} onClick={() => openSnapshot()}>
            오늘 자산 기록
          </Button>
        </div>
        <div className="overview-meta">
          <span>
            <span className="status-dot" /> 직접 기록한 자산 기준{" "}
            <span className="muted">· 실시간 시세 아님</span>
          </span>
          <span>
            {latest
              ? `${latest.date.replaceAll("-", ".")} 최근 기록`
              : "아직 저장된 기록이 없어요"}
          </span>
        </div>
        <div className="metric-grid">
          <div className="metric featured">
            <div className="metric-label">
              현재 총 평가자산 <Wallet size={17} />
            </div>
            <div className="metric-value">
              {money(value)}
              <span>원</span>
            </div>
            <div className="metric-foot">
              보유 자산 {holdings.length}개 <span className="mini-divider" />{" "}
              {accounts.length}개 계좌 그룹
            </div>
            <div className="metric-decoration">↗</div>
          </div>
          <div className="metric">
            <div className="metric-label">
              총 투자원금 <Landmark size={17} />
            </div>
            <div className="metric-value">
              {money(cost)}
              <span>원</span>
            </div>
            <div className="metric-foot">현재 보유종목 매입원금 합계</div>
          </div>
          <div className="metric">
            <div className="metric-label">
              평가손익 <ChartNoAxesCombined size={17} />
            </div>
            <div className={"metric-value " + cls(profit)}>
              {money(profit, true)}
              <span>원</span>
            </div>
            <div className="metric-foot">
              <Badge tone={cls(profit)}>
                {percent(cost ? profit / cost : 0)}
              </Badge>
              <span>원금 대비</span>
            </div>
          </div>
          <div className="metric">
            <div className="metric-label">
              최근 기록의 시장 손익 <ArrowUpRight size={17} />
            </div>
            <div className={"metric-value " + cls(daily)}>
              {daily == null ? "—" : money(daily, true)}
              {daily != null && <span>원</span>}
            </div>
            <div className="metric-foot">
              {latest?.market_rate != null && (
                <Badge tone={cls(latest.market_rate)}>
                  {percent(latest.market_rate)}
                </Badge>
              )}
              <span>원금 증감 제외</span>
            </div>
          </div>
        </div>
        <div className="dashboard-charts">
          <section className="card chart-card">
            <div className="card-heading">
              <div>
                <h2>자산의 흐름</h2>
                <p>나의 투자 여정을 한눈에</p>
              </div>
              <div className="segmented">
                {["1개월", "3개월", "전체"].map((s) => (
                  <button
                    key={s}
                    className={period === s ? "selected" : ""}
                    onClick={() => setPeriod(s)}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
            <div className="chart-legend">
              <span>
                <i style={{ background: "#31866a" }} />
                평가금액
              </span>
              <span>
                <i className="dashed" />
                투자원금
              </span>
              <span className="push-right">단위: 원</span>
            </div>
            {renderChart()}
            <div className="chart-note">
              <CircleHelp size={13} /> 시장 손익 = 평가금액 증감 − 투자원금 증감
            </div>
          </section>
          <section className="card allocation">
            <div className="card-heading">
              <div>
                <h2>자산 구성</h2>
                <p>계좌별로 나눠보는 내 자산</p>
              </div>
              <span className="tiny-tag">평가금액 기준</span>
            </div>
            <div className="donut-wrap">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    isAnimationActive={false}
                    data={accounts}
                    dataKey="value"
                    innerRadius={65}
                    outerRadius={84}
                    paddingAngle={3}
                    stroke="none"
                  >
                    {accounts.map((a, i) => (
                      <Cell key={a.name} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v) => won(v)} />
                </PieChart>
              </ResponsiveContainer>
              <div className="donut-label">
                <span>전체 자산</span>
                <strong>
                  {(value / 1e8).toFixed(2)}
                  <small>억</small>
                </strong>
              </div>
            </div>
            <div className="allocation-list">
              {accounts.map((a, i) => (
                <div key={a.name}>
                  <span>
                    <i style={{ background: COLORS[i % COLORS.length] }} />
                    {a.name}
                  </span>
                  <b>{value ? ((a.value / value) * 100).toFixed(1) : 0}%</b>
                </div>
              ))}
            </div>
          </section>
        </div>
        <section className="dca-banner">
          <div className="dca-banner-icon">
            <Repeat2 size={27} />
          </div>
          <div className="dca-banner-copy">
            <span className="eyebrow">DAILY DCA</span>
            <h3>꾸준함을 기록하는 가장 쉬운 방법</h3>
            <p>
              매일 {activePlans.length}개 종목, <b>{won(dailyPlan)}</b>의 투자
              습관
            </p>
          </div>
          <div className="dca-banner-status">
            <span>오늘 기록</span>
            <b>
              {doneToday}
              <small> / {activePlans.length}개</small>
            </b>
          </div>
          <Button
            variant="primary"
            icon={CheckCheck}
            onClick={() => navigate("dca")}
          >
            오늘 매수 기록하기 <ArrowRight size={16} />
          </Button>
        </section>
        <section className="card holdings-card">
          <div className="card-heading">
            <div>
              <h2>
                보유 자산 <span className="count">{holdings.length}</span>
              </h2>
              <p>계좌별 투자 현황을 확인해 보세요.</p>
            </div>
            <Button variant="text" onClick={() => navigate("holdings")}>
              전체 보기 <ChevronRight size={15} />
            </Button>
          </div>
          <div className="table-tabs">
            {["전체 계좌", ...new Set(holdings.map((h) => h.broker))].map(
              (s) => (
                <button
                  onClick={() => setAccount(s)}
                  className={account === s ? "active" : ""}
                  key={s}
                >
                  {s}
                </button>
              ),
            )}
          </div>
          <HoldingsTable
            rows={holdings
              .filter((h) => account === "전체 계좌" || h.broker === account)
              .slice(0, 5)}
            total={value}
            onEdit={(h) => setModal({ type: "holding", holding: h })}
          />
          <div className="table-footer">
            <span>총 {holdings.length}개 자산 중 주요 자산 표시</span>
            <span>
              <ShieldCheck size={13} /> 이 서버에 안전하게 보관 중
            </span>
          </div>
        </section>
        <div className="small-footnote">
          모든 금액은 원화 기준입니다. 매수 기록과 자산 기록은 분리되어 있어,
          보유자산 수정 후 날짜별 자산 기록을 저장해 주세요.
        </div>
      </>
    );
  }
  return (
    <div className="app">
      <aside className={"sidebar " + (menu ? "open" : "")}>
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            navigate("dashboard");
          }}
        >
          <div className="brand-mark">
            <Leaf size={25} />
          </div>
          <span>
            모아<span className="brand-dot">.</span>
          </span>
          <small>MY ASSET JOURNAL</small>
        </a>
        <div className="workspace-label">나의 투자 공간</div>
        <nav>
          {NAV.map(([id, Icon, label]) => (
            <button
              key={id}
              className={page === id ? "active" : ""}
              onClick={() => navigate(id)}
            >
              <Icon size={19} />
              <span>{label}</span>
              {id === "dca" && (
                <span className="nav-badge">{activePlans.length}</span>
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="growth-card">
            <div className="growth-art">
              <Leaf size={29} />
              <div />
              <div />
            </div>
            <h4>작은 기록, 큰 변화</h4>
            <p>
              꾸준히 쌓아가는
              <br />
              나만의 투자 여정
            </p>
          </div>
          <button
            className="backup-nav"
            onClick={() => {
              location.href = apiUrl("/backup");
            }}
          >
            <FolderArchive size={17} /> 데이터 백업{" "}
            <ArrowDownToLine size={15} />
          </button>
          <div className="user-profile">
            <div className="avatar">나</div>
            <div>
              <b>나의 포트폴리오</b>
              <span>개인 투자 관리</span>
            </div>
            <ShieldCheck size={16} />
          </div>
        </div>
      </aside>
      {menu && (
        <div className="sidebar-overlay" onClick={() => setMenu(false)} />
      )}
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="icon-button mobile-menu"
              aria-label="메뉴 열기"
              onClick={() => setMenu(true)}
            >
              <Menu size={21} />
            </button>
            <span>나의 투자 공간</span>
            <ChevronRight size={13} />
            <b>{NAV.find((n) => n[0] === page)?.[2]}</b>
          </div>
          <div className="topbar-right">
            <span>
              <CalendarDays size={15} />
              {today.replaceAll("-", ".")}
            </span>
            <span className="local-chip">
              <i />
              로컬 저장
            </span>
            <div className="avatar small-avatar">나</div>
          </div>
        </header>
        <main>
          {page === "dashboard" ? (
            dashboard()
          ) : page === "holdings" ? (
            <HoldingsPage
              {...{ holdings, value }}
              onAdd={() => setModal({ type: "holding" })}
              onEdit={(h) => setModal({ type: "holding", holding: h })}
            />
          ) : page === "dca" ? (
            <DcaPage
              {...{ data, busy, perform }}
              onTrade={() => setModal({ type: "trade" })}
              onPlan={(p) => setModal({ type: "plan", plan: p })}
              onScreenshot={() => {
                navigate("import");
                setTimeout(
                  () =>
                    document.querySelector("[data-screenshot-tab]")?.click(),
                  0,
                );
              }}
            />
          ) : page === "history" ? (
            <HistoryPage
              {...{ snapshots, perform }}
              onSave={openSnapshot}
              chart={renderChart()}
              {...{ period, setPeriod }}
            />
          ) : (
            <ImportPage {...{ data, perform, busy, notify }} />
          )}
        </main>
        <footer className="app-footer">
          <span>
            모아 <b>·</b> 오늘도 차곡차곡
          </span>
          <span>개인 투자 기록 v1.0</span>
        </footer>
      </div>
      {toast && (
        <div className="toast" role="status">
          <CircleAlert size={17} />
          <span>{toast}</span>
          <button
            className="icon-button"
            aria-label="알림 닫기"
            onClick={() => setToast(null)}
          >
            <X size={15} />
          </button>
        </div>
      )}
      {modal?.type === "holding" && (
        <HoldingModal
          holding={modal.holding}
          {...{ busy, perform }}
          onClose={() => setModal(null)}
        />
      )}
      {modal?.type === "snapshot" && (
        <SnapshotModal
          snapshot={modal.snapshot}
          {...{ data, cost, value, busy, perform }}
          onClose={() => setModal(null)}
        />
      )}
      {modal?.type === "trade" && (
        <TradeModal
          {...{ data, busy, perform }}
          onClose={() => setModal(null)}
        />
      )}
      {modal?.type === "plan" && (
        <PlanModal
          plan={modal.plan}
          {...{ data, busy, perform }}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}

function HoldingsTable({ rows, total, onEdit }) {
  return (
    <div className="table-scroll">
      <table className="holdings-table">
        <thead>
          <tr>
            <th>종목</th>
            <th>계좌</th>
            <th className="number">투자원금</th>
            <th className="number">평가금액</th>
            <th className="number">평가손익 / 수익률</th>
            <th className="number">비중</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {rows.map((h) => (
            <tr key={h.id}>
              <td>
                <div className="asset-cell">
                  <AssetIcon holding={h} />
                  <div>
                    <b title={h.name}>{h.ticker}</b>
                    <span title={h.name}>
                      {h.name === h.ticker ? h.category : h.name}
                    </span>
                  </div>
                </div>
              </td>
              <td>
                <span className="account-name">{h.broker}</span>
                <span className="account-type">{h.account}</span>
              </td>
              <td className="number">
                {money(h.cost)}
                <small>원</small>
              </td>
              <td className="number strong">
                {money(h.value)}
                <small>원</small>
              </td>
              <td className={"number " + cls(h.value - h.cost)}>
                <b>
                  {money(h.value - h.cost, true)}
                  <small>원</small>
                </b>
                <span className="return-rate">
                  {percent(h.cost ? (h.value - h.cost) / h.cost : 0)}
                </span>
              </td>
              <td className="number">
                <span>{total ? ((h.value / total) * 100).toFixed(1) : 0}%</span>
                <div className="weight-bar">
                  <i
                    style={{
                      width:
                        Math.min(100, total ? (h.value / total) * 100 : 0) +
                        "%",
                    }}
                  />
                </div>
              </td>
              <td>
                <button
                  className="icon-button"
                  aria-label={`${h.ticker} ${h.broker} 수정`}
                  onClick={() => onEdit(h)}
                >
                  <Pencil size={14} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {!rows.length && (
        <Empty title="표시할 자산이 없어요">
          엑셀을 가져오거나 보유 자산을 추가해 주세요.
        </Empty>
      )}
    </div>
  );
}

function HoldingsPage({ holdings, value, onAdd, onEdit }) {
  const [search, setSearch] = useState(""),
    [broker, setBroker] = useState("전체 계좌");
  const rows = holdings.filter(
    (h) =>
      (broker === "전체 계좌" || h.broker === broker) &&
      `${h.name} ${h.ticker} ${h.account}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">MY PORTFOLIO</div>
          <h1>보유 자산</h1>
          <p>증권부터 연금까지, 한곳에서 관리하세요.</p>
        </div>
        <Button icon={Plus} variant="primary" onClick={onAdd}>
          자산 추가
        </Button>
      </div>
      <div className="info-box">
        <CircleHelp size={17} />
        <span>
          평가금액은 직접 입력한 최신 값입니다. 연필 버튼으로 갱신한 뒤 ‘자산
          변동 기록’에서 날짜별 기록을 저장하세요. 소수점 수량이 없는 종목은
          수량을 임의로 계산하지 않습니다.
        </span>
      </div>
      <section className="card">
        <div className="toolbar">
          <div className="search-input">
            <Search size={17} />
            <input
              aria-label="종목 검색"
              placeholder="종목명, 티커 검색"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select
            aria-label="계좌 필터"
            value={broker}
            onChange={(e) => setBroker(e.target.value)}
          >
            {["전체 계좌", ...new Set(holdings.map((h) => h.broker))].map(
              (b) => (
                <option key={b}>{b}</option>
              ),
            )}
          </select>
          <span className="muted push-right">
            {rows.length}개 · {won(rows.reduce((a, h) => a + h.value, 0))}
          </span>
        </div>
        <HoldingsTable {...{ rows, total: value, onEdit }} />
      </section>
    </>
  );
}

function HoldingModal({ holding, busy, perform, onClose }) {
  const [h, setH] = useState(
    holding || {
      name: "",
      ticker: "",
      broker: "토스증권",
      account: "해외계좌",
      category: "성장 ETF",
      cost: 0,
      value: 0,
      quantity: null,
      note: "",
    },
  );
  const set = (key, value) => setH({ ...h, [key]: value });
  const save = (e) => {
    e.preventDefault();
    perform(
      () =>
        post(
          holding ? "/holdings/" + holding.id : "/holdings",
          h,
          holding ? "PUT" : "POST",
        ),
      "보유 자산을 저장했습니다. 날짜별 기록은 별도로 저장해 주세요.",
    );
  };
  return (
    <Modal
      title={holding ? "보유 자산 수정" : "새 자산 추가"}
      subtitle="투자원금과 평가금액은 모두 원화 기준으로 입력해 주세요."
      {...{ onClose }}
    >
      <form onSubmit={save}>
        <div className="form-grid">
          <Field label="종목명">
            <input
              required
              value={h.name}
              onChange={(e) => set("name", e.target.value)}
            />
          </Field>
          <Field label="티커 / 표시 이름">
            <input
              required
              value={h.ticker}
              onChange={(e) => set("ticker", e.target.value)}
            />
          </Field>
          <Field label="증권사 / 은행">
            <input
              required
              value={h.broker}
              onChange={(e) => set("broker", e.target.value)}
            />
          </Field>
          <Field label="계좌 구분">
            <input
              required
              value={h.account}
              onChange={(e) => set("account", e.target.value)}
            />
          </Field>
          <Field label="투자원금 (원)">
            <NumberInput
              required
              value={h.cost}
              onChange={(v) => set("cost", v)}
            />
          </Field>
          <Field label="현재 평가금액 (원)">
            <NumberInput
              required
              value={h.value}
              onChange={(v) => set("value", v)}
            />
          </Field>
          <Field label="보유 수량 (선택)">
            <NumberInput
              step="any"
              value={h.quantity}
              onChange={(v) => set("quantity", v)}
            />
          </Field>
          <Field label="자산 구분">
            <input
              value={h.category}
              onChange={(e) => set("category", e.target.value)}
            />
          </Field>
        </div>
        <Field label="메모">
          <textarea
            value={h.note}
            onChange={(e) => set("note", e.target.value)}
          />
        </Field>
        <div className="modal-actions">
          <Button onClick={onClose}>취소</Button>
          <Button type="submit" variant="primary" disabled={busy}>
            {busy ? "저장 중…" : "자산 저장"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function SnapshotModal({
  snapshot,
  data,
  cost,
  value,
  busy,
  perform,
  onClose,
}) {
  const [s, setS] = useState(
    snapshot || { date: data.today, cost, value, note: "" },
  );
  const existing = data.snapshots.some((r) => r.date === s.date),
    [overwrite, setOverwrite] = useState(Boolean(snapshot));
  return (
    <Modal
      title={snapshot ? "자산 기록 수정" : "오늘의 자산 기록"}
      subtitle="현재 보유자산 합계를 기본으로 채웠어요. 해당 날짜의 실제 금액으로 수정할 수 있습니다."
      {...{ onClose }}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          perform(
            () => post("/snapshots", { ...s, overwrite }),
            "자산 기록을 저장했습니다.",
          );
        }}
      >
        <Field label="기록 날짜">
          <input
            required
            type="date"
            max={data.today}
            value={s.date}
            onChange={(e) => setS({ ...s, date: e.target.value })}
          />
        </Field>
        <div className="form-grid">
          <Field label="총 투자원금 (원)">
            <NumberInput
              required
              value={s.cost}
              onChange={(v) => setS({ ...s, cost: v })}
            />
          </Field>
          <Field label="총 평가금액 (원)">
            <NumberInput
              required
              value={s.value}
              onChange={(v) => setS({ ...s, value: v })}
            />
          </Field>
        </div>
        <div className="snapshot-preview">
          <span>평가손익</span>
          <strong className={cls(s.value - s.cost)}>
            {won(s.value - s.cost)}{" "}
            <small>({percent(s.cost ? (s.value - s.cost) / s.cost : 0)})</small>
          </strong>
        </div>
        <Field label="오늘의 메모 (선택)">
          <textarea
            placeholder="매수 내역이나 시장에 대한 생각을 남겨보세요."
            value={s.note}
            onChange={(e) => setS({ ...s, note: e.target.value })}
          />
        </Field>
        {existing && (
          <label className="check-label">
            <input
              type="checkbox"
              checked={overwrite}
              onChange={(e) => setOverwrite(e.target.checked)}
            />
            이 날짜의 기존 기록을 수정합니다.
          </label>
        )}
        <p className="fine-print">
          시장 손익은 직전 기록 대비 원금 변동을 제외해 계산합니다. 이 기록은
          보유종목 금액을 변경하지 않습니다.
        </p>
        <div className="modal-actions">
          <Button onClick={onClose}>취소</Button>
          <Button
            type="submit"
            variant="primary"
            disabled={busy || (existing && !overwrite)}
          >
            기록 저장
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function TradeModal({ data, busy, perform, onClose }) {
  const [t, setT] = useState({
    date: data.today,
    holding_id: data.holdings[0]?.id || "",
    amount: null,
    quantity: null,
    note: "",
  });
  return (
    <Modal
      title="매수 기록 추가"
      subtitle="실제로 체결된 매수만 기록해 주세요. 금액은 수수료를 포함한 원화 매입원금입니다."
      {...{ onClose }}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          perform(
            () => post("/trades", { trades: [t] }),
            "매수 기록을 저장했습니다.",
          );
        }}
      >
        <div className="form-grid">
          <Field label="매수 날짜">
            <input
              required
              type="date"
              max={data.today}
              value={t.date}
              onChange={(e) => setT({ ...t, date: e.target.value })}
            />
          </Field>
          <Field label="계좌 · 종목">
            <select
              required
              value={t.holding_id}
              onChange={(e) => setT({ ...t, holding_id: e.target.value })}
            >
              {data.holdings.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.broker} · {h.account} · {h.ticker}
                </option>
              ))}
            </select>
          </Field>
          <Field label="체결금액 (원)">
            <NumberInput
              required
              min="1"
              value={t.amount}
              onChange={(v) => setT({ ...t, amount: v })}
            />
          </Field>
          <Field label="체결 수량 (선택)">
            <NumberInput
              min="0.00000001"
              step="any"
              value={t.quantity}
              onChange={(v) => setT({ ...t, quantity: v })}
            />
          </Field>
        </div>
        <Field label="메모">
          <input
            value={t.note}
            onChange={(e) => setT({ ...t, note: e.target.value })}
          />
        </Field>
        <p className="info-box compact">
          매입금액만큼 보유 원금과 평가금액에 더합니다. 시세 변동은 이후
          보유자산에서 갱신해 주세요. 날짜별 자산 기록은 별도로 저장합니다.
        </p>
        <div className="modal-actions">
          <Button onClick={onClose}>취소</Button>
          <Button
            type="submit"
            variant="primary"
            disabled={busy || !data.holdings.length}
          >
            매수 저장
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function PlanModal({ plan, data, busy, perform, onClose }) {
  const [p, setP] = useState(
    plan
      ? { ...plan, active: Boolean(plan.active) }
      : { holding_id: data.holdings[0]?.id || "", amount: 15000, active: true },
  );
  return (
    <Modal
      title={plan ? "DCA 계획 수정" : "DCA 계획 추가"}
      subtitle="계획을 저장해도 실제 매수나 거래 기록이 자동으로 생성되지는 않아요."
      {...{ onClose }}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          perform(
            () =>
              post(
                "/plans" + (plan ? "/" + plan.id : ""),
                p,
                plan ? "PUT" : "POST",
              ),
            "DCA 계획을 저장했습니다.",
          );
        }}
      >
        <Field label="매수할 계좌 · 종목">
          <select
            disabled={Boolean(plan)}
            value={p.holding_id}
            onChange={(e) => setP({ ...p, holding_id: e.target.value })}
          >
            {data.holdings.map((h) => (
              <option key={h.id} value={h.id}>
                {h.broker} · {h.account} · {h.ticker}
              </option>
            ))}
          </select>
        </Field>
        <Field label="하루 계획금액 (원)">
          <NumberInput
            required
            min="1"
            value={p.amount}
            onChange={(v) => setP({ ...p, amount: v })}
          />
        </Field>
        <label className="check-label">
          <input
            type="checkbox"
            checked={p.active}
            onChange={(e) => setP({ ...p, active: e.target.checked })}
          />
          적립 계획 사용
        </label>
        <div className="modal-actions">
          <Button onClick={onClose}>취소</Button>
          <Button
            variant="primary"
            type="submit"
            disabled={busy || !p.holding_id}
          >
            계획 저장
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function DcaPage({ data, busy, perform, onTrade, onPlan, onScreenshot }) {
  const [date, setDate] = useState(data.today),
    [selected, setSelected] = useState({}),
    [amounts, setAmounts] = useState({}),
    [review, setReview] = useState(false),
    [filter, setFilter] = useState("");
  const active = data.plans.filter((p) => p.active),
    getH = (id) => data.holdings.find((h) => h.id === id),
    done = new Set(
      data.trades.filter((t) => t.date === date).map((t) => t.plan_id),
    );
  const remaining = active.filter((p) => !done.has(p.id)),
    chosen = remaining.filter((p) => selected[p.id] !== false),
    total = chosen.reduce((a, p) => a + Number(amounts[p.id] ?? p.amount), 0);
  const save = async () => {
    const ok = await perform(
      () =>
        post("/trades", {
          trades: chosen.map((p) => ({
            date,
            holding_id: p.holding_id,
            amount: Number(amounts[p.id] ?? p.amount),
            plan_id: p.id,
            source: "dca",
            note: "DCA 일괄 기록",
          })),
        }),
      `${chosen.length}건의 매수를 기록했습니다.`,
      false,
    );
    if (ok) setReview(false);
  };
  const month = data.trades.filter(
    (t) => t.date.slice(0, 7) === date.slice(0, 7) && t.plan_id,
  );
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">DOLLAR COST AVERAGING</div>
          <h1>매일의 꾸준함, DCA</h1>
          <p>복잡한 입력은 줄이고, 투자 습관에 집중하세요.</p>
        </div>
        <div className="button-row">
          <Button icon={Camera} onClick={onScreenshot}>
            스크린샷 입력
          </Button>
          <Button variant="primary" icon={Plus} onClick={onTrade}>
            매수 직접 기록
          </Button>
        </div>
      </div>
      <div className="three-stats">
        <div className="card mini-stat">
          <span>하루 계획금액</span>
          <strong>{won(active.reduce((a, p) => a + p.amount, 0))}</strong>
          <small>{active.length}개 종목 적립 중</small>
        </div>
        <div className="card mini-stat">
          <span>{Number(date.slice(5, 7))}월 DCA 누적 매수</span>
          <strong>{won(month.reduce((a, t) => a + t.amount, 0))}</strong>
          <small>실제 기록한 {month.length}건 기준</small>
        </div>
        <div className="card mini-stat">
          <span>선택한 날짜의 기록</span>
          <strong>
            {active.filter((p) => done.has(p.id)).length}
            <small> / {active.length}개</small>
          </strong>
          <small>{date.replaceAll("-", ".")} 기준</small>
        </div>
      </div>
      <section className="card">
        <div className="card-heading">
          <div>
            <h2>오늘의 매수 체크리스트</h2>
            <p>체결 여부를 확인하고, 실제 매수금액으로 기록하세요.</p>
          </div>
          <div className="button-row">
            <input
              aria-label="DCA 기록 날짜"
              type="date"
              max={data.today}
              value={date}
              onChange={(e) => {
                setDate(e.target.value);
                setSelected({});
                setAmounts({});
              }}
            />
            <Button icon={Settings2} onClick={() => onPlan()}>
              계획 추가
            </Button>
          </div>
        </div>
        <div className="dca-grid">
          {data.plans.map((p) => {
            const h = getH(p.holding_id),
              isDone = done.has(p.id);
            return (
              <div
                className={
                  "plan-card " +
                  (isDone ? "done " : "") +
                  (!p.active ? "inactive" : "")
                }
                key={p.id}
              >
                <div className="plan-card-top">
                  <AssetIcon holding={h} />
                  <div>
                    <b>{h?.ticker}</b>
                    <small>
                      {h?.broker} · {h?.account}
                    </small>
                  </div>
                  <button
                    className="icon-button push-right"
                    aria-label={`${h?.ticker} 계획 수정`}
                    onClick={() => onPlan(p)}
                  >
                    <Pencil size={14} />
                  </button>
                </div>
                <div className="plan-amount">
                  <span>1일 매수금액 (원)</span>
                  <NumberInput
                    aria-label={`${h?.ticker} 체결금액`}
                    min="1"
                    value={amounts[p.id] ?? p.amount}
                    disabled={isDone || !p.active}
                    onChange={(v) => setAmounts({ ...amounts, [p.id]: v })}
                  />
                </div>
                {!p.active ? (
                  <Badge>일시 중지</Badge>
                ) : isDone ? (
                  <Badge tone="positive">
                    <Check size={13} /> 기록 완료
                  </Badge>
                ) : (
                  <label className="check-label">
                    <input
                      type="checkbox"
                      checked={selected[p.id] !== false}
                      onChange={(e) =>
                        setSelected({ ...selected, [p.id]: e.target.checked })
                      }
                    />
                    실제 체결 확인
                  </label>
                )}
              </div>
            );
          })}
        </div>
        {!data.plans.length && (
          <Empty title="매일 쌓아갈 종목을 추가해 보세요">
            보유자산을 등록한 뒤 적립 계획을 추가할 수 있어요.
          </Empty>
        )}
        <div className="batch-footer">
          <div>
            <span>선택한 {chosen.length}건</span>
            <b>{won(total)}</b>
            <small>미국장 휴장일에는 실제 체결 여부를 확인하세요.</small>
          </div>
          <Button
            variant="primary"
            icon={CheckCheck}
            disabled={!chosen.length || busy}
            onClick={() => setReview(true)}
          >
            선택한 매수 일괄 기록
          </Button>
        </div>
      </section>
      <section className="card section-gap">
        <div className="card-heading">
          <div>
            <h2>매수 기록</h2>
            <p>직접 입력과 스크린샷 입력 내역을 함께 확인하세요.</p>
          </div>
          <input
            className="filter-month"
            aria-label="매수 기록 월 필터"
            type="month"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>매수일</th>
                <th>종목 · 계좌</th>
                <th className="number">체결금액</th>
                <th className="number">수량</th>
                <th>입력 방식</th>
                <th>메모</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {data.trades
                .filter((t) => !filter || t.date.startsWith(filter))
                .map((t) => (
                  <tr key={t.id}>
                    <td>{t.date}</td>
                    <td>
                      <b>{getH(t.holding_id)?.ticker}</b>
                      <span className="account-type">
                        {getH(t.holding_id)?.broker}
                      </span>
                    </td>
                    <td className="number strong">{won(t.amount)}</td>
                    <td className="number">{t.quantity ?? "미입력"}</td>
                    <td>
                      <Badge>
                        {t.source === "dca"
                          ? "DCA"
                          : t.source === "screenshot"
                            ? "스크린샷"
                            : "직접 입력"}
                      </Badge>
                    </td>
                    <td className="memo-cell">{t.note || "—"}</td>
                    <td>
                      <button
                        className="icon-button"
                        aria-label="매수 기록 취소"
                        onClick={() => {
                          if (
                            confirm(
                              "이 매수 기록을 취소하고 보유자산에서 매입금액을 되돌릴까요? 이후 수정이 없는 최신 거래만 취소할 수 있습니다.",
                            )
                          )
                            perform(
                              () =>
                                api("/trades/" + t.id, { method: "DELETE" }),
                              "매수 기록을 취소했습니다.",
                              false,
                            );
                        }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
          {!data.trades.filter((t) => !filter || t.date.startsWith(filter))
            .length && (
            <Empty title="아직 매수 기록이 없어요">
              위 체크리스트로 첫 DCA 기록을 남겨보세요.
            </Empty>
          )}
        </div>
      </section>
      {review && (
        <Modal
          title="실제 체결 내역이 맞나요?"
          subtitle={`${date} · ${chosen.length}건 · ${won(total)}`}
          onClose={() => setReview(false)}
        >
          <div className="review-list">
            {chosen.map((p) => (
              <div key={p.id}>
                <b>{getH(p.holding_id)?.ticker}</b>
                <span>{won(amounts[p.id] ?? p.amount)}</span>
              </div>
            ))}
          </div>
          <p className="info-box compact">
            저장하면 매입원금과 현재 평가금액에 체결금액을 더합니다. 실제 수량은
            ‘보유 자산’에서 갱신할 수 있어요. 매수 기록만으로 날짜별 자산 기록이
            생성되지는 않습니다.
          </p>
          <div className="modal-actions">
            <Button onClick={() => setReview(false)}>돌아가기</Button>
            <Button variant="primary" disabled={busy} onClick={save}>
              {busy ? "저장 중…" : "체결 확인 · 기록 저장"}
            </Button>
          </div>
        </Modal>
      )}
    </>
  );
}

function HistoryPage({ snapshots, perform, onSave, chart, period, setPeriod }) {
  const [month, setMonth] = useState("");
  const rows = [...snapshots]
    .reverse()
    .filter((s) => !month || s.date.startsWith(month));
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">ASSET JOURNAL</div>
          <h1>시간이 쌓인 자산 기록</h1>
          <p>원금의 변화와 시장의 움직임을 구분해서 살펴보세요.</p>
        </div>
        <Button variant="primary" icon={Plus} onClick={() => onSave()}>
          자산 기록 추가
        </Button>
      </div>
      <section className="card chart-card">
        <div className="card-heading">
          <div>
            <h2>자산 변동 추이</h2>
            <p>총 {snapshots.length}일의 기록</p>
          </div>
          <div className="segmented">
            {["1개월", "3개월", "전체"].map((s) => (
              <button
                key={s}
                className={period === s ? "selected" : ""}
                onClick={() => setPeriod(s)}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
        <div className="chart-legend">
          <span>
            <i style={{ background: "#31866a" }} />
            평가금액
          </span>
          <span>
            <i className="dashed" />
            투자원금
          </span>
        </div>
        {chart}
      </section>
      <section className="card section-gap">
        <div className="card-heading">
          <h2>날짜별 기록</h2>
          <div className="button-row">
            <input
              aria-label="자산 기록 월 필터"
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
            />
            {month && (
              <Button variant="text" onClick={() => setMonth("")}>
                전체
              </Button>
            )}
            <a className="button" href={apiUrl("/export.xlsx")}>
              <Download size={15} /> 엑셀 내보내기
            </a>
          </div>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>날짜</th>
                <th className="number">투자원금</th>
                <th className="number">평가금액</th>
                <th className="number">평가손익</th>
                <th className="number">시장 손익</th>
                <th className="number">시장 수익률</th>
                <th>메모</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => (
                <tr key={s.date}>
                  <td>{s.date}</td>
                  <td className="number">{money(s.cost)}</td>
                  <td className="number strong">{money(s.value)}</td>
                  <td className={"number " + cls(s.profit)}>
                    {money(s.profit, true)}
                  </td>
                  <td className={"number " + cls(s.market_change)}>
                    {s.market_change == null
                      ? "—"
                      : money(s.market_change, true)}
                  </td>
                  <td className={"number " + cls(s.market_rate)}>
                    {s.market_rate == null ? "—" : percent(s.market_rate)}
                  </td>
                  <td className="memo-cell" title={s.note}>
                    {s.note || "—"}
                  </td>
                  <td>
                    <div className="button-row">
                      <button
                        className="icon-button"
                        aria-label={`${s.date} 기록 수정`}
                        onClick={() => onSave(s)}
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        className="icon-button"
                        aria-label={`${s.date} 기록 삭제`}
                        onClick={() => {
                          if (
                            confirm(
                              `${s.date} 자산 기록을 삭제할까요? 보유종목과 매수기록은 유지됩니다.`,
                            )
                          )
                            perform(
                              () =>
                                api("/snapshots/" + s.date, {
                                  method: "DELETE",
                                }),
                              "자산 기록을 삭제했습니다.",
                              false,
                            );
                        }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!rows.length && (
            <Empty title="해당 기간의 기록이 없어요">
              첫 기록을 추가하거나 다른 기간을 선택해 주세요.
            </Empty>
          )}
        </div>
        <div className="table-footer">
          단위: 원 · 시장 손익 = 평가금액 증감 − 원금 증감 · 기록 사이 간격이
          여러 날이면 해당 기간의 변동입니다.
        </div>
      </section>
    </>
  );
}

function ImportPage({ data, perform, busy, notify }) {
  const [tab, setTab] = useState("excel"),
    [preview, setPreview] = useState(null),
    [recognition, setRecognition] = useState(null),
    [working, setWorking] = useState(false),
    [fileName, setFileName] = useState(""),
    [image, setImage] = useState(""),
    [replace, setReplace] = useState(false),
    [rows, setRows] = useState([]),
    [date, setDate] = useState(data.today);
  useEffect(
    () => () => {
      if (image) URL.revokeObjectURL(image);
    },
    [image],
  );
  const upload = async (file) => {
    if (!file) return;
    if (file.size > 10000000) {
      notify("파일은 10MB 이하로 올려 주세요.");
      return;
    }
    setFileName(file.name);
    setWorking(true);
    setPreview(null);
    setRecognition(null);
    setReplace(false);
    try {
      const form = new FormData();
      form.append("file", file);
      if (tab === "excel") {
        setPreview(
          await api("/import/preview", { method: "POST", body: form }),
        );
      } else {
        setImage(URL.createObjectURL(file));
        const result = await api("/ocr", { method: "POST", body: form });
        setRecognition(result);
        setRows(
          result.candidates.map((c) => ({
            ...c,
            holding_id:
              data.holdings.find(
                (h) => h.ticker === c.ticker && h.broker === "토스증권",
              )?.id ||
              data.holdings.find((h) => h.ticker === c.ticker)?.id ||
              "",
            selected: true,
          })),
        );
      }
    } catch (e) {
      notify(e.message);
    } finally {
      setWorking(false);
    }
  };
  const changeRow = (i, key, v) =>
    setRows(rows.map((r, n) => (n === i ? { ...r, [key]: v } : r)));
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">LESS TYPING, MORE INVESTING</div>
          <h1>입력은 더 가볍게</h1>
          <p>쓰던 엑셀은 그대로, 매일의 매수는 스크린샷으로.</p>
        </div>
        <a href={apiUrl("/export.xlsx")} className="button">
          <ArrowDownToLine size={16} /> 엑셀 내보내기
        </a>
      </div>
      <div className="import-tabs">
        <button
          className={tab === "excel" ? "active" : ""}
          onClick={() => {
            setTab("excel");
            setPreview(null);
          }}
        >
          <FileSpreadsheet size={18} />
          엑셀 가져오기
        </button>
        <button
          data-screenshot-tab
          className={tab === "screenshot" ? "active" : ""}
          onClick={() => {
            setTab("screenshot");
            setRecognition(null);
          }}
        >
          <ImagePlus size={18} />
          스크린샷 인식
        </button>
      </div>
      <section className="card import-card">
        <div className="card-heading">
          <div>
            <h2>
              {tab === "excel"
                ? "기존 투자 기록, 한 번에 가져오기"
                : "매수 내역을 캡처해서 올려주세요"}
            </h2>
            <p>
              {tab === "excel"
                ? "‘보유종목(입력)’과 ‘일별 수익률’ 시트를 읽고, 매일 적립 메모에서 DCA 계획을 가져옵니다."
                : "이미지는 이 서버의 OCR로만 처리합니다. 외부 AI 서비스로 전송하지 않아요."}
            </p>
          </div>
          <Badge>{tab === "excel" ? ".xlsx" : "PNG · JPG · WEBP"}</Badge>
        </div>
        <label
          className={"upload-zone " + (working ? "working" : "")}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            if (!working) upload(e.dataTransfer.files[0]);
          }}
        >
          <input
            type="file"
            aria-label={
              tab === "excel" ? "엑셀 파일 선택" : "스크린샷 파일 선택"
            }
            accept={tab === "excel" ? ".xlsx" : ".png,.jpg,.jpeg,.webp"}
            disabled={working}
            onChange={(e) => {
              upload(e.target.files[0]);
              e.target.value = "";
            }}
          />
          {working ? (
            <Loader2 className="spin" size={35} />
          ) : tab === "excel" ? (
            <FileSpreadsheet size={35} />
          ) : (
            <Camera size={35} />
          )}
          <h3>
            {working
              ? tab === "excel"
                ? "엑셀의 기록을 읽고 있어요…"
                : "이미지 속 체결 내역을 읽고 있어요…"
              : "여기에 파일을 놓거나 클릭해서 선택하세요"}
          </h3>
          <p>
            {working
              ? "잠시만 기다려 주세요."
              : tab === "excel"
                ? "기존 파일은 수정하지 않아요 · 최대 10MB"
                : "선명한 체결 내역 화면을 사용해 주세요 · 최대 10MB"}
          </p>
          <span className="upload-button">
            {working ? "처리 중…" : "파일 선택"}
          </span>
        </label>
        {tab === "excel" && preview && (
          <div className="import-preview">
            <h3>
              <Check size={18} /> {fileName}
            </h3>
            <div className="three-stats">
              <div>
                <span>보유자산</span>
                <b>{preview.holdings.length}개</b>
              </div>
              <div>
                <span>날짜별 기록</span>
                <b>{preview.snapshots.length}일</b>
              </div>
              <div>
                <span>DCA 계획</span>
                <b>{preview.plans.length}개</b>
              </div>
            </div>
            <div className="review-list">
              <div>
                <span>보유자산 평가금액 합계</span>
                <b>{won(preview.holdings.reduce((a, h) => a + h.value, 0))}</b>
              </div>
              <div>
                <span>최근 기록 날짜</span>
                <b>{preview.date}</b>
              </div>
            </div>
            {preview.warnings.map((w, i) => (
              <p className="fine-print" key={i}>
                · {w}
              </p>
            ))}
            {Boolean(data.holdings.length) && (
              <label className="check-label warning-box">
                <input
                  type="checkbox"
                  checked={replace}
                  onChange={(e) => setReplace(e.target.checked)}
                />
                기존 보유자산·자산기록·매수기록·DCA 계획을 이 엑셀로 교체합니다.
                교체 직전에 서버에 자동 백업됩니다.
              </label>
            )}
            <Button
              variant="primary"
              disabled={busy || (Boolean(data.holdings.length) && !replace)}
              onClick={async () => {
                const ok = await perform(
                  () =>
                    post("/import/confirm", { token: preview.token, replace }),
                  "엑셀을 가져왔습니다.",
                  false,
                );
                if (ok) setPreview(null);
              }}
            >
              확인 후 {data.holdings.length ? "교체" : "가져오기"}
            </Button>
          </div>
        )}
        {tab === "screenshot" && recognition && (
          <div className="ocr-review">
            <div>
              <h3>인식 결과를 확인해 주세요</h3>
              <p className="muted">
                총 체결금액(원), 종목과 계좌를 반드시 확인하세요. 달러 금액은
                실제 적용환율로 원화 환산해 입력해 주세요.
              </p>
              <Field label="체결 날짜">
                <input
                  type="date"
                  max={data.today}
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </Field>
              {rows.map((r, i) => (
                <div className="ocr-row" key={i}>
                  <label className="check-label">
                    <input
                      type="checkbox"
                      checked={r.selected}
                      onChange={(e) =>
                        changeRow(i, "selected", e.target.checked)
                      }
                    />
                    기록 {i + 1}
                  </label>
                  <Field label="계좌 · 종목">
                    <select
                      required
                      value={r.holding_id}
                      onChange={(e) =>
                        changeRow(i, "holding_id", e.target.value)
                      }
                    >
                      <option value="">종목을 선택하세요</option>
                      {data.holdings.map((h) => (
                        <option key={h.id} value={h.id}>
                          {h.broker} · {h.account} · {h.ticker}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <div className="form-grid">
                    <Field label="총 체결금액 (원)">
                      <NumberInput
                        min="1"
                        placeholder="실제 금액 확인 필수"
                        value={r.amount}
                        onChange={(v) => changeRow(i, "amount", v)}
                      />
                    </Field>
                    <Field label="체결 수량 (선택)">
                      <NumberInput
                        step="any"
                        value={r.quantity}
                        onChange={(v) => changeRow(i, "quantity", v)}
                      />
                    </Field>
                  </div>
                </div>
              ))}
              {!rows.length && (
                <p className="info-box compact">
                  자동으로 구분한 종목이 없습니다. 아래에서 기록 행을 추가하고
                  인식된 문자를 참고해 입력해 주세요.
                </p>
              )}
              <Button
                icon={Plus}
                onClick={() =>
                  setRows([
                    ...rows,
                    {
                      holding_id: "",
                      amount: null,
                      quantity: null,
                      selected: true,
                    },
                  ])
                }
              >
                기록 행 추가
              </Button>
              <details>
                <summary>인식한 원문 보기</summary>
                <pre className="ocr-text">{recognition.text}</pre>
              </details>
              <div className="modal-actions">
                <Button
                  variant="primary"
                  disabled={
                    busy ||
                    !rows.some((r) => r.selected) ||
                    rows.some(
                      (r) =>
                        r.selected &&
                        (!r.holding_id || !r.amount || r.amount <= 0),
                    )
                  }
                  onClick={async () => {
                    const ok = await perform(
                      () =>
                        post("/trades", {
                          trades: rows
                            .filter((r) => r.selected)
                            .map((r) => ({
                              date,
                              holding_id: r.holding_id,
                              amount: r.amount,
                              quantity: r.quantity,
                              source: "screenshot",
                              note: "스크린샷 확인 후 입력",
                            })),
                        }),
                      "스크린샷 매수 기록을 저장했습니다.",
                      false,
                    );
                    if (ok) {
                      setRecognition(null);
                      setImage("");
                      setRows([]);
                    }
                  }}
                >
                  내용 확인 · 매수 기록 저장
                </Button>
              </div>
            </div>
            <div>
              <img
                className="screenshot-preview"
                src={image}
                alt="업로드한 체결 내역 원본"
              />
              <div className="fine-print">
                인식된 날짜와 환율을 자동 적용하지 않습니다. 총액 대신 단가가
                입력되지 않았는지 확인하세요.
              </div>
            </div>
          </div>
        )}
      </section>
      <div className="import-tips">
        <div>
          <ShieldCheck size={21} />
          <h4>내 데이터는 내 서버에</h4>
          <p>엑셀과 스크린샷 내용은 외부 인식 서비스로 전송되지 않습니다.</p>
        </div>
        <div>
          <CheckCheck size={21} />
          <h4>확인하고 저장해요</h4>
          <p>
            인식 결과를 검토한 뒤 저장합니다. DCA의 날짜별 중복 기록을
            방지합니다.
          </p>
        </div>
        <div>
          <Download size={21} />
          <h4>언제든 다시 엑셀로</h4>
          <p>
            기록을 엑셀로 내보내거나 전체 데이터베이스를 백업할 수 있습니다.
          </p>
        </div>
      </div>
      {data.meta.import && (
        <div className="import-source">
          <FileSpreadsheet size={17} />
          <div>
            <b>현재 데이터의 출처</b>
            <span>
              {data.meta.import.filename} · 데이터 기준 {data.meta.import.date}
            </span>
          </div>
          <Badge tone="positive">가져오기 완료</Badge>
        </div>
      )}
    </>
  );
}

createRoot(document.getElementById("root")).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>,
);
