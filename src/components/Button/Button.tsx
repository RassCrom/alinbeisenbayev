import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import Icon, { type IconName } from '../Icon/Icon';

export interface ButtonProps {
  /** `primary` is the solid accent fill, reserved for the call to action. `quiet` is text with an icon. */
  variant?: 'primary' | 'quiet';
  /** 52 px and 44 px tall. */
  size?: 'md' | 'sm';
  /** A router link when `to` is set, an anchor when `href` is, otherwise a button. */
  to?: string;
  href?: string;
  /** With `href`: the link leaves the site, so it opens in a new tab. */
  external?: boolean;
  type?: 'button' | 'submit';
  /** Trailing icon. */
  icon?: IconName;
  onClick?: () => void;
  children: ReactNode;
}

export default function Button({
  variant = 'primary',
  size = 'md',
  to,
  href,
  external = false,
  type = 'button',
  icon,
  onClick,
  children,
}: ButtonProps) {
  const className = `button button--${variant} button--${size} focus-ring`;
  const content = (
    <>
      {children}
      {icon && <Icon name={icon} />}
    </>
  );

  if (to !== undefined) {
    return (
      <Link to={to} className={className} data-icon={icon} onClick={onClick}>
        {content}
      </Link>
    );
  }
  if (href !== undefined) {
    return (
      <a
        href={href}
        target={external ? '_blank' : undefined}
        rel={external ? 'noreferrer' : undefined}
        className={className}
        data-icon={icon}
        onClick={onClick}
      >
        {content}
      </a>
    );
  }
  return (
    <button type={type} className={className} data-icon={icon} onClick={onClick}>
      {content}
    </button>
  );
}
