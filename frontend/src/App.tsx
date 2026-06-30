import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./hooks/AuthContext";
import { SyncProvider } from "./hooks/SyncContext";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { AppLayout } from "./components/AppLayout";
import { LoginPage } from "./pages/LoginPage";
import { RegisterPage } from "./pages/RegisterPage";
import { DashboardPage } from "./pages/DashboardPage";
import { ProductsPage } from "./pages/products/ProductsPage";
import { StockPage } from "./pages/inventory/StockPage";
import { KasirPage } from "./pages/kasir/KasirPage";
import { ReceiptPage } from "./pages/kasir/ReceiptPage";
import { LaporanPage } from "./pages/laporan/LaporanPage";
import { PelangganPage } from "./pages/pelanggan/PelangganPage";
import { PembelianPage } from "./pages/pembelian/PembelianPage";
import { PromoPage } from "./pages/promo/PromoPage";
import { CustomerDisplay } from "./pages/display/CustomerDisplay";
import { PengaturanPage } from "./pages/pengaturan/PengaturanPage";

function App() {
  return (
    <AuthProvider>
      <SyncProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            {/* Layar pelanggan: jendela kedua, tanpa shell aplikasi. */}
            <Route path="/display" element={<CustomerDisplay />} />

            <Route element={<ProtectedRoute />}>
              <Route element={<AppLayout />}>
                <Route path="/" element={<DashboardPage />} />
                <Route path="/kasir" element={<KasirPage />} />
                <Route path="/struk/:id" element={<ReceiptPage />} />
                <Route path="/laporan" element={<LaporanPage />} />
                <Route path="/products" element={<ProductsPage />} />
                <Route path="/stok" element={<StockPage />} />
                <Route path="/pelanggan" element={<PelangganPage />} />
                <Route element={<ProtectedRoute roles={["admin", "owner"]} />}>
                  <Route path="/pembelian" element={<PembelianPage />} />
                  <Route path="/promo" element={<PromoPage />} />
                  <Route path="/pengaturan" element={<PengaturanPage />} />
                </Route>
              </Route>
            </Route>
          </Routes>
        </BrowserRouter>
      </SyncProvider>
    </AuthProvider>
  );
}

export default App;
