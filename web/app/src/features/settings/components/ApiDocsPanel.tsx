import { useEffect } from 'react';

import { useQuery } from '@tanstack/react-query';
import { useRouterState } from '@tanstack/react-router';
import { ApiReferenceReact } from '@scalar/api-reference-react';
import '@scalar/api-reference-react/style.css';
import { Empty, Result, Spin, Typography } from 'antd';

import {
  fetchSettingsApiDocsCatalog,
  fetchSettingsApiDocsCategorySpec,
  settingsApiDocsCatalogQueryKey,
  settingsApiDocsCategorySpecQueryKey
} from '../api/api-docs';
import './api-docs-panel.css';

function updateCategoryQuery(categoryId: string | null, mode: 'push' | 'replace' = 'push') {
  const nextUrl = new URL(window.location.href);

  if (categoryId) {
    nextUrl.searchParams.set('category', categoryId);
  } else {
    nextUrl.searchParams.delete('category');
  }

  nextUrl.searchParams.delete('operation');

  const nextPath = `${nextUrl.pathname}${nextUrl.search}`;

  if (mode === 'replace') {
    window.history.replaceState({}, '', nextPath);
  } else {
    window.history.pushState({}, '', nextPath);
  }

  window.dispatchEvent(new PopStateEvent('popstate'));
}

export function ApiDocsPanel() {
  const locationSearch = useRouterState({
    select: (state) => state.location.search as Record<string, unknown>
  });
  const requestedCategoryId =
    typeof locationSearch.category === 'string' ? locationSearch.category : null;

  const catalogQuery = useQuery({
    queryKey: settingsApiDocsCatalogQueryKey,
    queryFn: fetchSettingsApiDocsCatalog
  });
  const categories = catalogQuery.data?.categories ?? [];
  const selectedCategoryId =
    categories.find((category) => category.id === requestedCategoryId)?.id ?? categories[0]?.id ?? null;
  const selectedCategory =
    categories.find((category) => category.id === selectedCategoryId) ?? null;
  const totalOperations = categories.reduce(
    (total, category) => total + category.operation_count,
    0
  );

  useEffect(() => {
    if (!selectedCategoryId || requestedCategoryId === selectedCategoryId) {
      return;
    }

    updateCategoryQuery(selectedCategoryId, 'replace');
  }, [requestedCategoryId, selectedCategoryId]);

  const categorySpecQuery = useQuery({
    queryKey: settingsApiDocsCategorySpecQueryKey(selectedCategoryId ?? ''),
    queryFn: () => fetchSettingsApiDocsCategorySpec(selectedCategoryId!),
    enabled: Boolean(selectedCategoryId)
  });

  if (catalogQuery.isLoading) {
    return (
      <div className="api-docs-panel__detail-state">
        <Spin size="large" />
        <Typography.Text type="secondary">正在加载接口目录</Typography.Text>
      </div>
    );
  }

  if (catalogQuery.isError) {
    return (
      <Result
        status="error"
        title="接口目录加载失败"
        subTitle="请确认当前账号仍具备 API 文档权限，并稍后重试。"
      />
    );
  }

  function renderCategoryStrip() {
    if (categories.length === 0) {
      return (
        <div className="api-docs-panel__category-empty">
          <Empty description="暂无接口分类" image={Empty.PRESENTED_IMAGE_SIMPLE} />
        </div>
      );
    }

    return (
      <section className="api-docs-panel__categories" aria-label="接口分类">
        {categories.map((category) => (
          <button
            key={category.id}
            type="button"
            className="api-docs-panel__category-card"
            data-active={selectedCategoryId === category.id}
            onClick={() => updateCategoryQuery(category.id)}
          >
            <span className="api-docs-panel__category-eyebrow">接口分类</span>
            <span className="api-docs-panel__category-label">{category.label}</span>
            <span className="api-docs-panel__category-meta">
              {category.operation_count} 个接口
            </span>
          </button>
        ))}
      </section>
    );
  }

  function renderDetailPane() {
    if (!selectedCategoryId) {
      return (
        <div className="api-docs-panel__detail-state">
          <Result
            status="info"
            title="当前暂无可访问接口"
            subTitle="当前账号还没有可展示的 API 文档分类。"
          />
        </div>
      );
    }

    if (categorySpecQuery.isLoading) {
      return (
        <div className="api-docs-panel__detail-state">
          <Spin size="large" />
          <Typography.Text type="secondary">
            正在加载 {selectedCategory?.label ?? '当前分类'} 的接口文档
          </Typography.Text>
        </div>
      );
    }

    if (categorySpecQuery.isError) {
      return (
        <div className="api-docs-panel__detail-state">
          <Result
            status="error"
            title="接口文档加载失败"
            subTitle="当前分类文档未能成功返回，请刷新后重试。"
          />
        </div>
      );
    }

    return (
      <div className="api-docs-panel__detail-viewer">
        <ApiReferenceReact
          configuration={{
            content: categorySpecQuery.data,
            hideClientButton: true,
            hideTestRequestButton: true,
            hiddenClients: true,
            documentDownloadType: 'none'
          }}
        />
      </div>
    );
  }

  return (
    <div className="api-docs-panel">
      <div className="api-docs-panel__header">
        <div>
          <Typography.Title level={3}>API 文档</Typography.Title>
          <Typography.Paragraph className="api-docs-panel__subtitle">
            顶部卡片只负责切换接口分类，Scalar 详情区直接展示当前分类下的完整 OpenAPI 文档。
          </Typography.Paragraph>
        </div>
        <Typography.Text className="api-docs-panel__count">
          共 {totalOperations} 个接口
        </Typography.Text>
      </div>

      {renderCategoryStrip()}

      <section className="api-docs-panel__detail" aria-label="API 文档详情">
        {renderDetailPane()}
      </section>
    </div>
  );
}
