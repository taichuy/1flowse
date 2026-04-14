import { useEffect } from 'react';

import { useMutation, useQuery } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { Result, Space, Spin, Typography } from 'antd';

import { useAuthStore } from '../../../state/auth-store';
import {
  changeMyPassword,
  fetchMyProfile,
  updateMyProfile
} from '../api/me';
import { ChangePasswordForm } from '../components/ChangePasswordForm';
import { ProfileForm } from '../components/ProfileForm';

function getErrorMessage(error: unknown): string | null {
  return error instanceof Error ? error.message : null;
}

export function MePage() {
  const navigate = useNavigate();
  const sessionStatus = useAuthStore((state) => state.sessionStatus);
  const csrfToken = useAuthStore((state) => state.csrfToken);
  const actor = useAuthStore((state) => state.actor);
  const me = useAuthStore((state) => state.me);
  const setMe = useAuthStore((state) => state.setMe);
  const setAnonymous = useAuthStore((state) => state.setAnonymous);

  const profileQuery = useQuery({
    queryKey: ['me', 'profile'],
    queryFn: fetchMyProfile,
    enabled: sessionStatus === 'authenticated' && me === null
  });

  useEffect(() => {
    if (profileQuery.data) {
      setMe(profileQuery.data);
    }
  }, [profileQuery.data, setMe]);

  const profileMutation = useMutation({
    mutationFn: async (input: Parameters<typeof updateMyProfile>[0]) => {
      if (!csrfToken) {
        throw new Error('missing csrf token');
      }

      return updateMyProfile(input, csrfToken);
    },
    onSuccess: (updatedProfile) => {
      setMe(updatedProfile);
    }
  });

  const changePasswordMutation = useMutation({
    mutationFn: async (input: Parameters<typeof changeMyPassword>[0]) => {
      if (!csrfToken) {
        throw new Error('missing csrf token');
      }

      await changeMyPassword(input, csrfToken);
    },
    onSuccess: async () => {
      setAnonymous();
      await navigate({ to: '/sign-in' });
    }
  });

  const currentProfile = profileQuery.data ?? me;

  if (profileQuery.isLoading) {
    return <Spin tip="正在加载个人资料..." />;
  }

  if (!currentProfile || !actor) {
    return (
      <Result
        status="warning"
        title="个人资料不可用"
        subTitle="当前会话缺少必要的用户上下文，请重新登录后重试。"
      />
    );
  }

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <div>
        <Typography.Title level={2}>个人资料</Typography.Title>
        <Typography.Paragraph>
          这里集中维护你的基础资料与登录安全设置，不承载系统级权限管理操作。
        </Typography.Paragraph>
      </div>

      <ProfileForm
        me={currentProfile}
        statusLabel={sessionStatus === 'authenticated' ? '已登录' : '未登录'}
        submitting={profileMutation.isPending}
        errorMessage={getErrorMessage(profileMutation.error)}
        onSubmit={async (input) => {
          await profileMutation.mutateAsync(input);
        }}
      />

      <ChangePasswordForm
        submitting={changePasswordMutation.isPending}
        errorMessage={getErrorMessage(changePasswordMutation.error)}
        onSubmit={(input) => changePasswordMutation.mutateAsync(input)}
      />
    </Space>
  );
}
