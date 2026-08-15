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
import { SafeTradingPage } from './pages/SafeTradingPage';
import { SignInPage } from './pages/SignInPage';
import { NotFoundPage } from './pages/NotFoundPage';

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
          <Route path="/safety" element={<SafeTradingPage />} />
          <Route path="/signin" element={<SignInPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
