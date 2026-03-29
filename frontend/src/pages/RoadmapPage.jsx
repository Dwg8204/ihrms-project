import SectionHeader from '../components/SectionHeader';

const plans = [
  {
    module: 'M3',
    title: 'Thi tuyển và đào tạo',
    suggestedApis: [
      'GET/POST /exam-applications',
      'PATCH /exam-applications/:id/result',
      'GET/POST /training-schedules'
    ]
  },
  {
    module: 'M4',
    title: 'Hợp đồng và cam kết',
    suggestedApis: [
      'POST /contracts',
      'PATCH /contracts/:id/status',
      'GET /contracts?candidate_id=...'
    ]
  },
  {
    module: 'M5',
    title: 'Tài chính và phí dịch vụ',
    suggestedApis: [
      'POST /transactions',
      'GET /transactions?candidate_id=...',
      'GET /finance/debt-alerts'
    ]
  },
  {
    module: 'M7',
    title: 'Vận hành lao động tại nước ngoài',
    suggestedApis: [
      'POST /overseas-records',
      'POST /incident-logs',
      'GET /overseas/contract-countdown'
    ]
  },
  {
    module: 'M8',
    title: 'Báo cáo điều hành',
    suggestedApis: [
      'GET /reports/recruitment',
      'GET /reports/finance',
      'GET /reports/operations'
    ]
  }
];

function RoadmapPage() {
  return (
    <section className="page-grid">
      <div className="surface">
        <SectionHeader title="Lộ trình" />
        <div className="roadmap-grid stagger">
          {plans.map((plan) => (
            <article key={plan.module} className="roadmap-card">
              <p className="roadmap-module">{plan.module}</p>
              <h4>{plan.title}</h4>
              <p className="roadmap-kicker">API dự kiến</p>
              <ul className="inline-list">
                {plan.suggestedApis.map((api) => (
                  <li key={api}>{api}</li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

export default RoadmapPage;
