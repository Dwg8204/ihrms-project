import { useState } from "react";
import SectionHeader from "../components/SectionHeader";
import { useI18n } from "../i18n/I18nProvider";

const messageTemplates = [
  {
    from: "Sarah Chen",
    title: "Updated design tokens for the dashboard",
    preview:
      "I've finished updating the OKLCH color tokens across all components...",
    date: "Feb 22",
    starred: true,
    dots: ["blue"],
  },
  {
    from: "Marcus Johnson",
    title: "TanStack Table v9 migration plan",
    preview:
      "I've been looking into the TanStack Table v9 release notes...",
    date: "Feb 22",
    starred: false,
    dots: ["blue", "red"],
  },
  {
    from: "Priya Sharma",
    title: "Q1 roadmap review - action items",
    preview:
      "Following up on our roadmap review yesterday. Here are the action items...",
    date: "Feb 22",
    starred: true,
    dots: ["red"],
  },
  {
    from: "Alex Rivera",
    title: "Re: Notification API endpoints",
    preview: "The notification endpoints are now deployed to staging...",
    date: "Feb 22",
    starred: false,
    dots: ["blue"],
  },
  {
    from: "GitHub",
    title: "[DashboardPack/apex-dashboard] PR #245 merged",
    preview:
      "Pull request #245 has been merged. Title: feat: add advanced form components...",
    date: "Feb 21",
    starred: false,
    dots: ["orange"],
  },
  {
    from: "Emma Taylor",
    title: "QA report: Density settings regression",
    preview:
      "During the latest QA pass, I found a regression with the density settings...",
    date: "Feb 21",
    starred: false,
    dots: ["blue"],
  },
  {
    from: "David Park",
    title: "Cloudflare Pages deployment config",
    preview: "I've looked into the auto-deploy setup for Cloudflare Pages...",
    date: "Feb 20",
    starred: true,
    dots: ["blue"],
  },
  {
    from: "Liam Murphy",
    title: "Architecture review: State management approach",
    preview:
      "I want to open a discussion about our state management approach...",
    date: "Feb 19",
    starred: false,
    dots: ["blue", "red"],
  },
];

function ChatPage() {
  const { t } = useI18n();
  const [isComposeOpen, setIsComposeOpen] = useState(false);

  const folders = [
    { label: t("chat.folders.inbox"), count: 5, active: true },
    { label: t("chat.folders.starred") },
    { label: t("chat.folders.sent") },
    { label: t("chat.folders.drafts"), count: 2 },
    { label: t("chat.folders.trash") },
  ];

  const labels = [
    { label: t("chat.labels.personal"), tone: "purple" },
    { label: t("chat.labels.work"), tone: "blue" },
    { label: t("chat.labels.important"), tone: "red" },
    { label: t("chat.labels.updates"), tone: "orange" },
  ];

  return (
    <section className="page-grid">
      <div className="chat-breadcrumb">{t("chat.breadcrumb")}</div>
      <SectionHeader title={t("chat.title")} subtitle={t("chat.subtitle")} />

      <div className="mail-shell">
        <aside className="mail-sidebar">
          <button
            type="button"
            className="mail-compose"
            onClick={() => setIsComposeOpen(true)}
          >
            {t("chat.compose")}
          </button>

          <nav className="mail-folder-list" aria-label="Mail folders">
            {folders.map((folder) => (
              <button
                key={folder.label}
                type="button"
                className={`mail-folder ${folder.active ? "mail-folder--active" : ""}`}
              >
                <span>{folder.label}</span>
                {folder.count ? <span className="mail-folder__count">{folder.count}</span> : null}
              </button>
            ))}
          </nav>

          <div className="mail-labels">
            <p className="mail-labels__title">{t("chat.labelsTitle")}</p>
            {labels.map((item) => (
              <div key={item.label} className="mail-label">
                <span className={`mail-label__dot mail-label__dot--${item.tone}`}></span>
                <span>{item.label}</span>
              </div>
            ))}
          </div>
        </aside>

        <div className="mail-panel">
          <div className="mail-toolbar">
            <input type="text" placeholder={t("chat.searchPlaceholder")} />
          </div>

          <div className="mail-list">
            {messageTemplates.map((message) => (
              <article key={`${message.from}-${message.title}`} className="mail-row">
                <div className="mail-row__check"></div>
                <div className={`mail-row__star ${message.starred ? "mail-row__star--active" : ""}`}>
                  *
                </div>
                <div className="mail-row__content">
                  <div className="mail-row__top">
                    <div className="mail-row__sender">
                      <strong>{message.from}</strong>
                      <div className="mail-row__dots">
                        {message.dots.map((dot, index) => (
                          <span
                            key={`${dot}-${index}`}
                            className={`mail-row__dot mail-row__dot--${dot}`}
                          ></span>
                        ))}
                      </div>
                    </div>
                    <span className="mail-row__date">{message.date}</span>
                  </div>
                  <div className="mail-row__subject">{message.title}</div>
                  <div className="mail-row__preview">{message.preview}</div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </div>

      {isComposeOpen ? (
        <div
          className="mail-compose-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="mail-compose-title"
        >
          <div
            className="mail-compose-modal__backdrop"
            onClick={() => setIsComposeOpen(false)}
          ></div>
          <div className="mail-compose-modal__card">
            <div className="mail-compose-modal__header">
              <h2 id="mail-compose-title">{t("chat.composeModalTitle")}</h2>
              <button
                type="button"
                className="mail-compose-modal__close"
                aria-label={t("chat.closeCompose")}
                onClick={() => setIsComposeOpen(false)}
              >
                x
              </button>
            </div>

            <form
              className="mail-compose-form"
              onSubmit={(event) => {
                event.preventDefault();
                setIsComposeOpen(false);
              }}
            >
              <input
                type="email"
                className="mail-compose-form__input mail-compose-form__input--focused"
                placeholder={t("chat.toPlaceholder")}
              />
              <input
                type="text"
                className="mail-compose-form__input"
                placeholder={t("chat.subjectPlaceholder")}
              />
              <textarea
                className="mail-compose-form__textarea"
                placeholder={t("chat.messagePlaceholder")}
                rows={9}
              ></textarea>

              <div className="mail-compose-form__actions">
                <button
                  type="button"
                  className="mail-compose-form__secondary"
                  onClick={() => setIsComposeOpen(false)}
                >
                  {t("chat.saveDraft")}
                </button>
                <button type="submit" className="mail-compose-form__primary">
                  <span aria-hidden="true">✈</span>
                  <span>{t("chat.send")}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </section>
  );
}

export default ChatPage;
