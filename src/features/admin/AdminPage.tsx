import { useEffect, useState, type FormEvent } from 'react';
import { ArrowRight, Download, LockKeyhole, LogOut } from 'lucide-react';
import { type SessionMetrics } from '../../shared/contracts';
import { backendConfigured, supabase } from '../../infrastructure/backend/reports';
import { PageTitle } from '../../shared/ui/PageTitle';

interface AdminReport {
  id: string;
  created_at: string;
  model_version: string;
  metrics: SessionMetrics;
  feedback: { usefulness: number; distraction: number; comment: string }[];
}
export function AdminPage({ onNotice }: { onNotice: (v: string) => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authorized, setAuthorized] = useState(false);
  const [busy, setBusy] = useState(false);
  const [rows, setRows] = useState<AdminReport[]>([]);
  const [message, setMessage] = useState('');
  const load = async () => {
    if (!supabase) return;
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setAuthorized(false);
      setRows([]);
      return;
    }
    const access = await supabase
      .from('admin_users')
      .select('user_id')
      .eq('user_id', user.id)
      .maybeSingle();
    if (access.error || !access.data) {
      setAuthorized(false);
      setRows([]);
      setMessage('Tài khoản này chưa được cấp quyền quản trị.');
      return;
    }
    const reports = await supabase
      .from('pilot_reports')
      .select('id,created_at,model_version,metrics,feedback(usefulness,distraction,comment)')
      .order('created_at', { ascending: false })
      .limit(500);
    if (reports.error) throw reports.error;
    setRows(reports.data as AdminReport[]);
    setAuthorized(true);
    setMessage('');
  };
  useEffect(() => {
    if (!supabase) return;
    void load().catch(() => setMessage('Không tải được báo cáo. Kiểm tra cấu hình và phân quyền.'));
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        setAuthorized(false);
        setRows([]);
      }
    });
    return () => data.subscription.unsubscribe();
  }, []);
  const login = async (e: FormEvent) => {
    e.preventDefault();
    if (!supabase) return;
    setBusy(true);
    setMessage('');
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      setPassword('');
      if (error) throw error;
      await load();
    } catch {
      setMessage('Không đăng nhập được. Kiểm tra tài khoản hoặc kết nối.');
    } finally {
      setBusy(false);
    }
  };
  const csv = () => {
    const cell = (v: unknown) =>
      `"${String(v ?? '')
        .replace(/^[=+@\-\t\r]/, "' $&")
        .replaceAll('"', '""')}"`;
    const data = [
      ['id', 'created_at', 'model', 'usefulness', 'distraction', 'comment', 'p95_ms'],
      ...rows.map((r) => [
        r.id,
        r.created_at,
        r.model_version,
        r.feedback[0]?.usefulness,
        r.feedback[0]?.distraction,
        r.feedback[0]?.comment,
        r.metrics.p95Ms,
      ]),
    ]
      .map((row) => row.map(cell).join(','))
      .join('\r\n');
    const url = URL.createObjectURL(
      new Blob(['\ufeff' + data], { type: 'text/csv;charset=utf-8' }),
    );
    const a = document.createElement('a');
    a.href = url;
    a.download = 'signemo-pilot.csv';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return (
    <>
      <PageTitle
        eyebrow="DÀNH CHO CHỦ DỰ ÁN"
        title="Quản trị pilot"
        subtitle="Phản hồi được đồng ý và số liệu tổng hợp. Không có hình ảnh cuộc trò chuyện."
      />
      {!backendConfigured ? (
        <section className="card settings-card narrow">
          <LockKeyhole size={30} />
          <h2>Chưa kết nối Supabase</h2>
          <p>
            Ứng dụng camera vẫn hoạt động cục bộ. Làm theo hướng dẫn triển khai trong repo để kết
            nối máy chủ và cấp tài khoản quản trị.
          </p>
        </section>
      ) : !authorized ? (
        <form className="card settings-card narrow" onSubmit={(e) => void login(e)}>
          <h2>Đăng nhập quản trị</h2>
          <label className="field">
            Email
            <input
              required
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <label className="field">
            Mật khẩu
            <input
              required
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          <button className="button primary" disabled={busy}>
            Đăng nhập <ArrowRight size={17} />
          </button>
          {message && <p role="alert">{message}</p>}
        </form>
      ) : (
        <>
          <div className="admin-summary">
            <div className="card">
              <span>Báo cáo pilot</span>
              <strong>{rows.length}</strong>
            </div>
            <div className="card">
              <span>Hữu ích trung bình</span>
              <strong>
                {rows.length
                  ? (
                      rows.reduce((s, r) => s + (r.feedback[0]?.usefulness ?? 0), 0) / rows.length
                    ).toFixed(1)
                  : '—'}
                <small>/5</small>
              </strong>
            </div>
            <div className="card">
              <span>Mức phân tâm</span>
              <strong>
                {rows.length
                  ? (
                      rows.reduce((s, r) => s + (r.feedback[0]?.distraction ?? 0), 0) / rows.length
                    ).toFixed(1)
                  : '—'}
                <small>/5</small>
              </strong>
            </div>
          </div>
          <div className="admin-actions">
            <button className="button secondary" onClick={csv}>
              <Download size={16} />
              Xuất CSV
            </button>
            <button
              className="button secondary"
              onClick={() => void load().catch(() => onNotice('Chưa cập nhật được báo cáo.'))}
            >
              Cập nhật
            </button>
            <button className="text-button" onClick={() => void supabase!.auth.signOut()}>
              <LogOut size={16} />
              Đăng xuất
            </button>
          </div>
          <div className="card table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Thời gian</th>
                  <th>Hữu ích</th>
                  <th>Phân tâm</th>
                  <th>Nhận xét</th>
                  <th>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td>{new Date(row.created_at).toLocaleDateString('vi-VN')}</td>
                    <td>{row.feedback[0]?.usefulness}/5</td>
                    <td>{row.feedback[0]?.distraction}/5</td>
                    <td>{row.feedback[0]?.comment || '—'}</td>
                    <td>
                      <button
                        className="text-button danger"
                        disabled={busy}
                        onClick={() => {
                          if (!window.confirm('Xóa báo cáo pilot này? Không thể khôi phục.'))
                            return;
                          setBusy(true);
                          void Promise.resolve(
                            supabase!.rpc('admin_delete_report', { report_id: row.id }),
                          )
                            .then(async ({ error }) => {
                              if (error) throw error;
                              await load();
                            })
                            .catch(() =>
                              onNotice('Không xóa được báo cáo. Kiểm tra quyền quản trị.'),
                            )
                            .finally(() => setBusy(false));
                        }}
                      >
                        Xóa
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!rows.length && <div className="empty-state">Chưa có báo cáo pilot.</div>}
          </div>
          <p className="fine-note">
            Hiển thị tối đa 500 báo cáo gần nhất. Pilot nhỏ không đại diện cho toàn bộ người dùng.
          </p>
        </>
      )}
    </>
  );
}
