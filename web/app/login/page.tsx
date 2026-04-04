import Link from "next/link";
import { redirect } from "next/navigation";
import { Card, Typography } from "antd";

import { WorkspaceLoginForm } from "@/components/workspace-login-form";
import { getServerAuthSession, getServerPublicAuthOptions } from "@/lib/server-workspace-access";

const { Title, Text } = Typography;

export default async function LoginPage() {
  const session = await getServerAuthSession();
  if (session) {
    redirect("/workspace");
  }

  const authOptions = await getServerPublicAuthOptions();

  return (
    <main className="login-shell login-shell-dify" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', background: '#f5f5f5' }}>
      <Card 
        style={{ width: 400, boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}
        bordered={false}
      >
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <Title level={3} style={{ margin: 0 }}>
            <span style={{ color: '#1677ff' }}>7</span>Flows
          </Title>
          <Text type="secondary">Workspace Sign In</Text>
        </div>
        <WorkspaceLoginForm authOptions={authOptions} />
      </Card>
    </main>
  );
}
