import { render, screen } from '@testing-library/react';
import { describe, expect, test } from 'vitest';

import { AppProviders } from '../../app/AppProviders';
import { StyleBoundaryHarness } from '../main';
import { getRuntimeScene, getSceneIdsForFiles } from '../registry';

describe('style boundary registry', () => {
  test('renders the account popup component scene and exposes scene metadata on window', async () => {
    const scene = getRuntimeScene('component.account-popup');

    const { container } = render(
      <AppProviders>
        <StyleBoundaryHarness scene={scene} />
      </AppProviders>
    );

    expect(await screen.findByText('Profile')).toBeInTheDocument();
    expect(window.__STYLE_BOUNDARY__?.scene.id).toBe('component.account-popup');
    expect(window.__STYLE_BOUNDARY__?.ready).toBe(true);
    expect(
      container.querySelector('[data-style-boundary-scene="component.account-popup"]')
    ).toBeInTheDocument();
  });

  test('throws when a requested scene id is missing', () => {
    expect(() => getRuntimeScene('component.missing')).toThrow(
      /Unknown style boundary scene/u
    );
  });

  test('maps changed files to explicitly declared scenes', () => {
    expect(
      getSceneIdsForFiles(['web/app/src/features/home/HomePage.tsx'])
    ).toEqual(['page.home']);
    expect(getSceneIdsForFiles(['web/app/src/styles/global.css'])).toEqual([
      'component.account-popup',
      'component.account-trigger',
      'page.home',
      'page.embedded-apps',
      'page.agent-flow'
    ]);
  });

  test('renders the home page scene inside the shared shell frame', async () => {
    const scene = getRuntimeScene('page.home');

    render(
      <AppProviders>
        <StyleBoundaryHarness scene={scene} />
      </AppProviders>
    );

    expect(await screen.findByText('1Flowse Bootstrap')).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Primary' })).toBeInTheDocument();
  });
});
