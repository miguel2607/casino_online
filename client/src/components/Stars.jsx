import { StarIcon } from './Icons.jsx';
import { fmt } from '../format.js';

export default function Stars({ value, size = 16, className = '', sign = false }) {
  const prefix = sign && value > 0 ? '+' : '';
  return (
    <span className={`stars ${className}`}>
      {prefix}
      {fmt(value)}
      <StarIcon size={size} />
    </span>
  );
}
