"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./nav-menu.module.css";

const items = [
  { href: "/", key: "home" },
  { href: "/lookup", key: "lookup" },
  { href: "/reports", key: "reports" },
  { href: "/top-group-a", key: "topGroupA" },
] as const;

/** "/" is current only on exactly "/"; the others also match their sub-paths. */
function isCurrent(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

export function NavMenu() {
  const t = useTranslations("shell");
  const pathname = usePathname();

  return (
    <nav aria-label={t("navLabel")} className={styles.nav}>
      <ul className={styles.list}>
        {items.map(({ href, key }) => {
          const current = isCurrent(pathname, href);
          return (
            <li key={href}>
              <Link href={href} aria-current={current ? "page" : undefined} className={current ? `${styles.link} ${styles.current}` : styles.link}>
                {t(`nav.${key}`)}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
