import Icon from './Icon';

export default function EmptyState({ title, message, action, icon = 'credit' }) {
  return (
    <div className="cl-empty">
      <div className="cl-empty-icon">
        <Icon name={icon} size={22} />
      </div>
      <div className="cl-empty-title">{title}</div>
      <p className="mb-3" style={{ maxWidth: 400, margin: '0 auto', fontSize: 13.5 }}>
        {message}
      </p>
      {action}
    </div>
  );
}
