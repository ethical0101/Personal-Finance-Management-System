import AssistantPanel from '../AssistantPanel.jsx'

export default function AskView({ assistant, name }) {
  return (
    <section>
      <div className="page-head">
        <div><h1>Ask AI</h1><p>A finance assistant that has read your accounts, budgets, goals and recent transactions — and nothing else.</p></div>
      </div>
      <div className="card chat"><AssistantPanel assistant={assistant} name={name} page /></div>
    </section>
  )
}
