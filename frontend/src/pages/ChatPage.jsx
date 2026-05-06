import { useMemo, useState } from "react";
import SectionHeader from "../components/SectionHeader";
import { financeService } from "../services/financeService";
import { recruitmentService } from "../services/recruitmentService";
import { documentService } from "../services/documentService";
import { getErrorMessage } from "../utils/toast";

function toDateInput(value) {
  return value.toISOString().slice(0, 10);
}

function startOfDay(value) {
  const d = new Date(value);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfDay(value) {
  const d = new Date(value);
  d.setHours(23, 59, 59, 999);
  return d;
}

function shiftDay(value, diff) {
  const d = new Date(value);
  d.setDate(d.getDate() + diff);
  return d;
}

function formatCurrency(value) {
  return new Intl.NumberFormat("vi-VN").format(Number(value || 0));
}

function formatPercent(value) {
  const n = Number(value || 0);
  return `${n.toFixed(1)}%`;
}

function sumByType(rows, type) {
  return rows
    .filter((row) => row.transaction_type === type)
    .reduce((acc, row) => acc + Number(row.amount_paid || 0), 0);
}

function growthPercent(current, previous) {
  if (!previous) return current > 0 ? 100 : 0;
  return ((current - previous) / previous) * 100;
}

async function loadFinanceRange(from, to) {
  const res = await financeService.getAllTransactions({
    date_from: toDateInput(from),
    date_to: toDateInput(to),
    limit: 2000,
  });
  const rows = res?.data || [];
  const income = sumByType(rows, "INCOME");
  const refund = sumByType(rows, "REFUND");
  const net = income - refund;
  const candidateCount = new Set(rows.map((row) => row.candidate_id)).size;

  return {
    rows,
    income,
    refund,
    net,
    candidateCount,
  };
}

function buildRanges(mode) {
  const today = new Date();
  if (mode === "day") {
    const currentFrom = startOfDay(today);
    const currentTo = endOfDay(today);
    const previousFrom = startOfDay(shiftDay(today, -1));
    const previousTo = endOfDay(shiftDay(today, -1));
    return { currentFrom, currentTo, previousFrom, previousTo };
  }

  const currentTo = endOfDay(today);
  const currentFrom = startOfDay(shiftDay(today, -6));
  const previousTo = endOfDay(shiftDay(today, -7));
  const previousFrom = startOfDay(shiftDay(today, -13));
  return { currentFrom, currentTo, previousFrom, previousTo };
}

function ChatPage() {
  const [mode, setMode] = useState("week");
  const [question, setQuestion] = useState("Tuần này vì sao doanh thu giảm?");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [answerBlocks, setAnswerBlocks] = useState([]);
  const [brief, setBrief] = useState(null);

  const modeLabel = useMemo(() => (mode === "day" ? "ngày" : "tuần"), [mode]);

  const buildSnapshot = async () => {
    const ranges = buildRanges(mode);
    const [current, previous, funnelRes, healthRes, visaRes] = await Promise.all([
      loadFinanceRange(ranges.currentFrom, ranges.currentTo),
      loadFinanceRange(ranges.previousFrom, ranges.previousTo),
      recruitmentService.getFunnelSummary(),
      documentService.getHealthExpiryAlerts(30),
      documentService.getVisaDelayAlerts(),
    ]);

    const healthAlerts = healthRes?.data || [];
    const visaAlerts = visaRes?.data || [];
    const funnel = funnelRes?.data || { by_status: [] };

    const statusMap = new Map();
    (funnel.by_status || []).forEach((row) => {
      statusMap.set(String(row.status || ""), Number(row.total || 0));
    });

    return {
      current,
      previous,
      healthAlerts,
      visaAlerts,
      statusMap,
    };
  };

  const buildExplainableInsights = (snapshot) => {
    const netDelta = snapshot.current.net - snapshot.previous.net;
    const netGrowth = growthPercent(snapshot.current.net, snapshot.previous.net);
    const refundGrowth = growthPercent(snapshot.current.refund, snapshot.previous.refund);

    const insights = [
      {
        title: "Biến động doanh thu thuần",
        conclusion:
          netDelta >= 0
            ? `Doanh thu thuần ${modeLabel} này tăng ${formatCurrency(netDelta)} VND.`
            : `Doanh thu thuần ${modeLabel} này giảm ${formatCurrency(Math.abs(netDelta))} VND.`,
        source: `Nguồn: bảng transactions (${toDateInput(buildRanges(mode).currentFrom)} -> ${toDateInput(buildRanges(mode).currentTo)})`,
        compare: `So với kỳ trước: ${formatPercent(netGrowth)} | Kỳ này ${formatCurrency(snapshot.current.net)} vs Kỳ trước ${formatCurrency(snapshot.previous.net)} VND.`,
        action:
          netDelta < 0
            ? "Hành động: Ưu tiên thu các khoản OVERDUE/PARTIALLY_PAID trong 48h và kiểm tra nhóm hoàn tiền bất thường."
            : "Hành động: Duy trì nhóm nguồn tuyển đang tạo doanh thu tốt và theo dõi chi phí hoàn tiền.",
      },
      {
        title: "Áp lực hoàn tiền",
        conclusion:
          snapshot.current.refund > 0
            ? `Tổng hoàn tiền kỳ này là ${formatCurrency(snapshot.current.refund)} VND.`
            : "Kỳ này chưa phát sinh hoàn tiền.",
        source: "Nguồn: transactions.transaction_type = REFUND",
        compare: `So với kỳ trước: ${formatPercent(refundGrowth)} | Kỳ trước ${formatCurrency(snapshot.previous.refund)} VND.`,
        action:
          snapshot.current.refund > snapshot.previous.refund
            ? "Hành động: Rà soát nguyên nhân hoàn tiền theo case (TH1/TH2/TH3), chặn phát sinh lặp lại."
            : "Hành động: Giữ quy trình phê duyệt hoàn tiền hiện tại, kiểm tra mẫu đơn có rủi ro cao.",
      },
      {
        title: "Rủi ro hồ sơ sắp quá hạn",
        conclusion: `Đang có ${snapshot.healthAlerts.length} cảnh báo sức khỏe và ${snapshot.visaAlerts.length} hồ sơ visa cần xử lý.`,
        source: "Nguồn: /alerts/health-expiry và /alerts/visa-delay",
        compare: "So sánh kỳ trước: hiện chưa có chuỗi lịch sử cảnh báo, đang dùng snapshot hiện tại.",
        action:
          snapshot.visaAlerts.length > 0
            ? "Hành động: Đẩy xử lý nhóm A (visa cảnh báo) trước để tránh trễ lịch xuất cảnh."
            : "Hành động: Tiếp tục theo dõi tự động mỗi ngày, chưa cần escalte rủi ro visa.",
      },
    ];

    return insights;
  };

  const generateBrief = async () => {
    try {
      setLoading(true);
      setError("");

      const snapshot = await buildSnapshot();
      const netDelta = snapshot.current.net - snapshot.previous.net;
      const netGrowth = growthPercent(snapshot.current.net, snapshot.previous.net);

      const highlights = [
        `Doanh thu thuần ${modeLabel}: ${formatCurrency(snapshot.current.net)} VND (Nguồn: transactions).`,
        `Tổng thu tiền: ${formatCurrency(snapshot.current.income)} VND; hoàn tiền: ${formatCurrency(snapshot.current.refund)} VND.`,
        `Ứng viên có phát sinh giao dịch: ${snapshot.current.candidateCount}.`,
        `Cảnh báo hồ sơ sức khỏe: ${snapshot.healthAlerts.length}; visa: ${snapshot.visaAlerts.length}.`,
        `Biến động doanh thu so với kỳ trước: ${formatPercent(netGrowth)} (${netDelta >= 0 ? "+" : ""}${formatCurrency(netDelta)} VND).`,
      ];

      const risks = [
        `R1: Doanh thu thuần đang ${netDelta < 0 ? "giảm" : "biến động"} so với kỳ trước (${formatPercent(netGrowth)}).`,
        `R2: Có ${snapshot.visaAlerts.length} hồ sơ visa có nguy cơ trễ tiến độ.`,
        `R3: Có ${snapshot.healthAlerts.length} hồ sơ sức khỏe cần xử lý trước hạn.`,
      ];

      const actions = [
        `A1: Đẩy xử lý nhóm A: ${Math.min(snapshot.visaAlerts.length, 5)} hồ sơ visa ưu tiên trong 24h.`,
        "A2: Mở chiến dịch thu hồi công nợ cho các khoản OVERDUE/PARTIALLY_PAID trong 48h.",
        "A3: Họp nhanh 15 phút với đầu mối hồ sơ để chốt danh sách ca rủi ro cao trong ngày.",
      ];

      setBrief({
        highlights,
        risks,
        actions,
        explainable: buildExplainableInsights(snapshot),
      });
      setAnswerBlocks([]);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const askQuestion = async () => {
    try {
      setLoading(true);
      setError("");
      const q = String(question || "").toLowerCase();

      const snapshot = await buildSnapshot();
      const netDelta = snapshot.current.net - snapshot.previous.net;
      const netGrowth = growthPercent(snapshot.current.net, snapshot.previous.net);

      let blocks;
      if (q.includes("doanh thu") || q.includes("giảm") || q.includes("thu")) {
        blocks = [
          {
            title: "Trả lời nhanh",
            content:
              netDelta < 0
                ? `Doanh thu thuần ${modeLabel} này giảm ${formatCurrency(Math.abs(netDelta))} VND so với kỳ trước.`
                : `Doanh thu thuần ${modeLabel} này tăng ${formatCurrency(netDelta)} VND so với kỳ trước.`,
          },
          {
            title: "Giải thích có số liệu nguồn",
            content: `Kỳ này: thu ${formatCurrency(snapshot.current.income)}, hoàn ${formatCurrency(snapshot.current.refund)}, thuần ${formatCurrency(snapshot.current.net)} VND. Kỳ trước: thuần ${formatCurrency(snapshot.previous.net)} VND. Biến động: ${formatPercent(netGrowth)}. Nguồn: transactions (lọc theo ngày).`,
          },
          {
            title: "Gợi ý hành động",
            content:
              "Ưu tiên thu nhóm công nợ quá hạn trước, khóa nguyên nhân hoàn tiền chính, và đẩy các hồ sơ visa rủi ro cao để bảo toàn dòng tiền xuất cảnh.",
          },
        ];
      } else if (q.includes("visa") || q.includes("hồ sơ") || q.includes("rủi ro")) {
        blocks = [
          {
            title: "Rủi ro vận hành hiện tại",
            content: `Hiện có ${snapshot.healthAlerts.length} cảnh báo sức khỏe và ${snapshot.visaAlerts.length} cảnh báo visa. Nguồn: alerts/health-expiry + alerts/visa-delay.`,
          },
          {
            title: "So sánh và mức độ",
            content:
              "Hệ thống chưa có baseline lịch sử cảnh báo theo tuần trong module này, nhưng snapshot hiện tại cho thấy cần xử lý visa trước để tránh kéo lùi lịch xuất cảnh.",
          },
          {
            title: "Gợi ý hành động",
            content: "Đẩy hồ sơ nhóm A (visa cảnh báo) trước, gán owner rõ ràng theo từng hồ sơ và kiểm tra lại mỗi cuối ngày.",
          },
        ];
      } else {
        blocks = [
          {
            title: "Mình có thể hỗ trợ các câu hỏi CEO sau",
            content:
              "1) Vì sao doanh thu giảm/tăng. 2) Rủi ro hồ sơ/visa nổi bật. 3) Việc nào cần quyết ngay hôm nay. Bạn có thể hỏi: 'Tuần này vì sao doanh thu giảm?'.",
          },
          {
            title: "Nguồn dữ liệu đang dùng",
            content:
              "transactions, funnel-summary, health-expiry alerts, visa-delay alerts; có so sánh kỳ trước cho chỉ số tài chính.",
          },
        ];
      }

      setAnswerBlocks(blocks);
      setBrief(null);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="page-grid">
      <SectionHeader
        title="AI Trợ lý CEO (Bản thô)"
        subtitle="Hỏi đáp điều hành, tạo brief ngày/tuần tự động, insight có số liệu nguồn và gợi ý hành động."
      />

      <div className="surface">
        <div className="inline-form" style={{ marginBottom: 12 }}>
          <label style={{ minWidth: 180 }}>
            Chu kỳ phân tích
            <select value={mode} onChange={(event) => setMode(event.target.value)}>
              <option value="day">Ngày</option>
              <option value="week">Tuần</option>
            </select>
          </label>
          <button type="button" className="btn" onClick={generateBrief} disabled={loading}>
            {loading ? "Đang tạo..." : `Tạo ${mode === "day" ? "Daily" : "Weekly"} Brief`}
          </button>
        </div>

        <label className="field-span-2" style={{ display: "grid", gap: 8 }}>
          Hỏi trợ lý CEO
          <textarea
            rows={3}
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            placeholder="Ví dụ: Tuần này vì sao doanh thu giảm?"
          />
        </label>
        <div className="row-actions" style={{ marginTop: 10 }}>
          <button type="button" className="btn ghost" onClick={askQuestion} disabled={loading}>
            {loading ? "Đang phân tích..." : "Phân tích câu hỏi"}
          </button>
        </div>
        {error ? <p className="error-text" style={{ marginTop: 10 }}>{error}</p> : null}
      </div>

      {answerBlocks.length ? (
        <div className="surface">
          <SectionHeader title="Kết quả hỏi đáp" subtitle="Có giải thích số liệu và gợi ý hành động." />
          <div className="page-grid">
            {answerBlocks.map((block) => (
              <div key={block.title} className="chart-surface">
                <h4>{block.title}</h4>
                <p className="muted" style={{ whiteSpace: "pre-wrap" }}>{block.content}</p>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {brief ? (
        <div className="surface two-col">
          <div>
            <SectionHeader title={`5 điểm nổi bật (${mode === "day" ? "Daily" : "Weekly"} Brief)`} />
            <ol className="muted" style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 8 }}>
              {brief.highlights.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ol>

            <SectionHeader title="3 rủi ro" />
            <ol className="muted" style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 8 }}>
              {brief.risks.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ol>

            <SectionHeader title="3 việc cần quyết" />
            <ol className="muted" style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 8 }}>
              {brief.actions.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ol>
          </div>

          <div>
            <SectionHeader title="Explainable Insights" subtitle="Mỗi kết luận có nguồn dữ liệu và so sánh kỳ trước." />
            <div className="page-grid">
              {brief.explainable.map((insight) => (
                <div key={insight.title} className="chart-surface">
                  <h4>{insight.title}</h4>
                  <p style={{ marginBottom: 8 }}>{insight.conclusion}</p>
                  <p className="muted" style={{ marginBottom: 6 }}>{insight.source}</p>
                  <p className="muted" style={{ marginBottom: 6 }}>{insight.compare}</p>
                  <p className="color-primary">{insight.action}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

export default ChatPage;
