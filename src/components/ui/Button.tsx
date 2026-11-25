import Link from "next/link";
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from "react";

export type ButtonVariant = "primary" | "secondary";
export type ButtonSize = "slide" | "detail" | "doc" | "sticky";

export function buttonClass(variant: ButtonVariant = "primary", size: ButtonSize = "doc", extra?: string) {
  return ["btn", variant === "primary" ? "btn-primary" : "btn-secondary", `btn-${size}`, extra].filter(Boolean).join(" ");
}

type Common = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
  children?: ReactNode;
};

type ButtonProps = Common & { href?: undefined } & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className" | "children">;
type LinkProps = Common & { href: string } & Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "className" | "children" | "href">;

function isLink(props: ButtonProps | LinkProps): props is LinkProps {
  return typeof props.href === "string";
}

function attrs<T extends object>(props: T, drop: string[]) {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(props)) {
    if (!drop.includes(key)) out[key] = value;
  }
  return out;
}

const OWN = ["variant", "size", "className", "children", "href"];

export function Button(props: ButtonProps | LinkProps) {
  const className = buttonClass(props.variant ?? "primary", props.size ?? "doc", props.className);
  if (isLink(props)) {
    const shared = attrs(props, OWN) as Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "className" | "href">;
    if (/^https?:/.test(props.href)) return <a className={className} href={props.href} {...shared}>{props.children}</a>;
    return <Link className={className} href={props.href} {...shared}>{props.children}</Link>;
  }
  return <button className={className} {...(attrs(props, OWN) as ButtonHTMLAttributes<HTMLButtonElement>)}>{props.children}</button>;
}
