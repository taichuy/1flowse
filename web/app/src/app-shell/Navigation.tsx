import { Link } from '@tanstack/react-router';
import { Menu } from 'antd';
import type { MenuProps } from 'antd';

import { getNavigationRoutes } from '../routes/route-helpers';
import { getSelectedRouteId } from '../routes/route-config';

function renderNavigationLink(
  pathname: string,
  label: string,
  useRouterLinks: boolean,
  isCurrent: boolean
) {
  if (useRouterLinks) {
    return (
      <Link
        to={pathname}
        className="app-shell-menu-link"
        aria-current={isCurrent ? 'page' : undefined}
      >
        {label}
      </Link>
    );
  }

  return (
    <a
      href={pathname}
      className="app-shell-menu-link"
      aria-current={isCurrent ? 'page' : undefined}
    >
      {label}
    </a>
  );
}

export function Navigation({
  pathname,
  useRouterLinks
}: {
  pathname: string;
  useRouterLinks: boolean;
}) {
  const selectedKey = getSelectedRouteId(pathname);
  const items: MenuProps['items'] = getNavigationRoutes().map((route) => ({
    key: route.id,
    label: renderNavigationLink(
      route.path,
      route.navLabel!,
      useRouterLinks,
      route.id === selectedKey
    )
  }));

  return (
    <nav className="app-shell-navigation" aria-label="Primary">
      <Menu
        className="app-shell-menu"
        mode="horizontal"
        selectedKeys={[selectedKey]}
        items={items}
        disabledOverflow
      />
    </nav>
  );
}
