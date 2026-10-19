import { Suspense, lazy } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { AppShell } from './components/AppShell';
import { HomePage } from './pages/HomePage';
import { BrowsePage } from './pages/BrowsePage';
import { SellersPage } from './pages/SellersPage';
import { ListingPage } from './pages/ListingPage';
import { SellPage } from './pages/SellPage';
import { MyListingsPage } from './pages/MyListingsPage';
import { ChatPage } from './pages/ChatPage';
import { FavoritesPage } from './pages/FavoritesPage';
import { ProfilePage } from './pages/ProfilePage';
import { SettingsPage } from './pages/SettingsPage';
import { ReviewsPage } from './pages/ReviewsPage';
import { SafeTradingPage } from './pages/SafeTradingPage';
import { SignInPage } from './pages/SignInPage';
import { OnboardingPage } from './pages/OnboardingPage';
import { SetPasswordPage } from './pages/SetPasswordPage';
import { PlansPage } from './pages/PlansPage';
import { NotificationsPage } from './pages/NotificationsPage';
import { TermsPage } from './pages/TermsPage';
import { PrivacyPage } from './pages/PrivacyPage';
import { NotFoundPage } from './pages/NotFoundPage';

// The two heaviest routes (image pipeline, moderation console) load on
// demand so the first paint of the marketplace isn't paying for them.
const PregradePage = lazy(() =>
  import('./pages/PregradePage').then((m) => ({ default: m.PregradePage })),
);
const AdminPage = lazy(() => import('./pages/AdminPage').then((m) => ({ default: m.AdminPage })));

function RouteFallback() {
  return (
    <div style={{ padding: '40px var(--pad-x)' }}>
      <div className="skeleton" style={{ height: 320 }} />
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppShell />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/browse" element={<BrowsePage />} />
          <Route path="/sellers" element={<SellersPage />} />
          <Route path="/listing/:id" element={<ListingPage />} />
          <Route path="/sell" element={<SellPage />} />
          <Route path="/sell/:id" element={<SellPage />} />
          <Route path="/my-listings" element={<MyListingsPage />} />
          <Route path="/chat" element={<ChatPage />} />
          <Route path="/chat/:conversationId" element={<ChatPage />} />
          <Route path="/favorites" element={<FavoritesPage />} />
          <Route path="/u/:username" element={<ProfilePage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/reviews" element={<ReviewsPage />} />
          <Route path="/safety" element={<SafeTradingPage />} />
          <Route path="/signin" element={<SignInPage />} />
          <Route path="/welcome" element={<OnboardingPage />} />
          <Route path="/set-password" element={<SetPasswordPage />} />
          <Route
            path="/pregrade"
            element={
              <Suspense fallback={<RouteFallback />}>
                <PregradePage />
              </Suspense>
            }
          />
          <Route path="/plans" element={<PlansPage />} />
          <Route path="/notifications" element={<NotificationsPage />} />
          <Route path="/terms" element={<TermsPage />} />
          <Route path="/privacy" element={<PrivacyPage />} />
          <Route
            path="/admin"
            element={
              <Suspense fallback={<RouteFallback />}>
                <AdminPage />
              </Suspense>
            }
          />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
