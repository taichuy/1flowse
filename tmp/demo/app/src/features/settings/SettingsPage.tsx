import { useState } from 'react';

import { Card, Col, Descriptions, Menu, Row, Table, Typography } from 'antd';
import type { MenuProps } from 'antd';

import { accessMatrix, apiSurface } from '../demo-data';

type SettingsSectionKey = 'profile' | 'team' | 'access' | 'api';

const settingsItems: MenuProps['items'] = [
  {
    key: 'profile',
    label: '个人资料'
  },
  {
    key: 'team',
    label: '团队'
  },
  {
    key: 'access',
    label: '访问控制'
  },
  {
    key: 'api',
    label: 'API 文档'
  }
];

export function SettingsPage() {
  const [activeSection, setActiveSection] = useState<SettingsSectionKey>('profile');

  return (
    <div className="demo-page">
      <section className="demo-page-hero">
        <span className="demo-kicker">L2 Manage Entry</span>
        <Typography.Title level={1}>设置</Typography.Title>
        <Typography.Paragraph className="demo-page-lede">
          当前设计把个人资料、团队、访问控制和 API 文档统一收进设置页，避免继续依赖零散的 bootstrap 卡片。
        </Typography.Paragraph>
      </section>

      <Row gutter={[18, 18]}>
        <Col xs={24} xl={7}>
          <Card className="demo-card settings-nav-card">
            <Menu
              mode="inline"
              selectedKeys={[activeSection]}
              items={settingsItems}
              onClick={(event) => setActiveSection(event.key as SettingsSectionKey)}
            />
          </Card>
        </Col>

        <Col xs={24} xl={17}>
          <Card className="demo-card settings-content-card">
            {activeSection === 'profile' ? (
              <Descriptions
                title="个人资料"
                column={1}
                colon={false}
                items={[
                  {
                    key: 'name',
                    label: '当前用户',
                    children: 'Mina Chen'
                  },
                  {
                    key: 'role',
                    label: '职责',
                    children: 'Platform Owner'
                  },
                  {
                    key: 'focus',
                    label: '本周关注',
                    children: '控制台壳层、访问控制矩阵和 Studio 收口'
                  }
                ]}
              />
            ) : null}

            {activeSection === 'team' ? (
              <Descriptions
                title="团队"
                column={1}
                colon={false}
                items={[
                  {
                    key: 'team',
                    label: '当前团队',
                    children: 'Growth Lab'
                  },
                  {
                    key: 'mode',
                    label: '工作区模式',
                    children: 'single-team / hosted auth'
                  },
                  {
                    key: 'policy',
                    label: '通知策略',
                    children: '运行告警触达 Platform Owner 与 Ops Lead'
                  }
                ]}
              />
            ) : null}

            {activeSection === 'access' ? (
              <div>
                <Typography.Title level={4}>角色矩阵</Typography.Title>
                <Table
                  rowKey="key"
                  pagination={false}
                  dataSource={accessMatrix}
                  columns={[
                    {
                      title: '角色',
                      dataIndex: 'role',
                      key: 'role'
                    },
                    {
                      title: '范围',
                      dataIndex: 'scope',
                      key: 'scope'
                    },
                    {
                      title: '权限',
                      dataIndex: 'permissions',
                      key: 'permissions'
                    }
                  ]}
                />
              </div>
            ) : null}

            {activeSection === 'api' ? (
              <div>
                <Typography.Title level={4}>API 文档入口</Typography.Title>
                <Table
                  rowKey="path"
                  pagination={false}
                  dataSource={apiSurface}
                  columns={[
                    {
                      title: 'Method',
                      dataIndex: 'method',
                      key: 'method'
                    },
                    {
                      title: 'Path',
                      dataIndex: 'path',
                      key: 'path'
                    },
                    {
                      title: '说明',
                      dataIndex: 'note',
                      key: 'note'
                    }
                  ]}
                />
              </div>
            ) : null}
          </Card>
        </Col>
      </Row>
    </div>
  );
}
