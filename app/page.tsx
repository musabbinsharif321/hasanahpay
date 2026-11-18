import { AppSplashIntro } from '@/components/AppSplashIntro';
import { AuthPortalRouter } from '@/components/AuthPortalRouter';

export default function HomePage() {
  return (
    <AppSplashIntro>
      <AuthPortalRouter />
    </AppSplashIntro>
  );
}
