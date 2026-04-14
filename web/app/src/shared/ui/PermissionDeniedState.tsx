import { Result } from 'antd';

export function PermissionDeniedState() {
  return (
    <Result
      status="403"
      title="无权限访问"
      subTitle="当前账号缺少访问该页面所需的权限。"
    />
  );
}
