import {
	BrowserRouter,
	Link,
	Navigate,
	Route,
	Routes,
	useNavigate,
	useParams,
} from "react-router-dom";
import { createContext, useContext, useEffect, useState } from "react";
import { authApi, ticketApi, usersApi } from "./api";
import TicketsPageAdvanced from "./TicketsPage";
import {
	Bar,
	BarChart,
	CartesianGrid,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis,
} from "recharts";
import "./App.css";

export const AuthContext = createContext(null);

function AuthProvider({ children }) {
	const [user, setUser] = useState(null);
	const [loading, setLoading] = useState(true);
	useEffect(() => {
		authApi
			.me()
			.then(({ user: current }) => setUser(current))
			.catch(() => {})
			.finally(() => setLoading(false));
	}, []);
	const value = {
		user,
		loading,
		login: async (data) => {
			const result = await authApi.login(data);
			setUser(result.user);
		},
		register: authApi.register,
		logout: async () => {
			await authApi.logout();
			setUser(null);
		},
	};
	return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

function useAuth() {
	return useContext(AuthContext);
}

export function ProtectedRoute({ children, roles }) {
	const { user, loading } = useAuth();
	if (loading)
		return <main className="loading-screen">Cargando sesión...</main>;
	if (!user) return <Navigate to="/login" replace />;
	if (roles && !roles.includes(user.role))
		return <Navigate to="/tickets" replace />;
	return children;
}

function Layout({ children }) {
	const { user, logout } = useAuth();
	return (
		<main className="app-shell">
			<header className="topbar">
				<div>
					<p className="eyebrow">HELPDESK / OPERACIONES</p>
					<h1>Centro de incidencias</h1>
				</div>
				<nav className="nav-links">
					<Link to="/tickets">Tickets</Link>
					{["agente", "admin"].includes(user.role) && (
						<Link to="/metricas">Métricas</Link>
					)}
					{user.role === "admin" && <Link to="/usuarios">Usuarios</Link>}
				</nav>
				<div className="profile">
					<span>{user.name}</span>
					<small>{user.role}</small>
					<button className="text-button" onClick={logout}>
						Salir
					</button>
				</div>
			</header>
			{children}
		</main>
	);
}

export function LoginPage() {
	const { user, login, register } = useAuth();
	const navigate = useNavigate();
	const [mode, setMode] = useState("login");
	const [form, setForm] = useState({ name: "", email: "", password: "" });
	const [error, setError] = useState("");
	if (user) return <Navigate to="/tickets" replace />;
	async function submit(event) {
		event.preventDefault();
		setError("");
		try {
			if (mode === "register") {
				await register(form);
				await login({ email: form.email, password: form.password });
			} else await login(form);
			navigate("/tickets");
		} catch (requestError) {
			setError(requestError.message);
		}
	}
	return (
		<main className="auth-shell">
			<section className="auth-copy">
				<p className="eyebrow">HELPDESK / OPERACIONES</p>
				<h1>El trabajo técnico, en orden.</h1>
				<p>
					Gestiona incidencias, prioridades y respuestas desde un único lugar.
				</p>
			</section>
			<form className="auth-panel" onSubmit={submit}>
				<div className="panel-heading">
					<span>Acceso seguro</span>
					<strong>{mode === "login" ? "Bienvenido" : "Crear cuenta"}</strong>
				</div>
				{mode === "register" && (
					<label>
						Nombre
						<input
							required
							minLength="2"
							value={form.name}
							onChange={(e) => setForm({ ...form, name: e.target.value })}
						/>
					</label>
				)}
				<label>
					Correo electrónico
					<input
						required
						type="email"
						value={form.email}
						onChange={(e) => setForm({ ...form, email: e.target.value })}
					/>
				</label>
				<label>
					Contraseña
					<input
						required
						minLength="8"
						type="password"
						value={form.password}
						onChange={(e) => setForm({ ...form, password: e.target.value })}
					/>
				</label>
				{error && (
					<p className="form-error" role="alert">
						{error}
					</p>
				)}
				<button className="primary-button">
					{mode === "login" ? "Entrar al panel" : "Registrarme"}
				</button>
				<button
					className="text-button"
					type="button"
					onClick={() => setMode(mode === "login" ? "register" : "login")}
				>
					{mode === "login" ? "Necesito una cuenta" : "Ya tengo una cuenta"}
				</button>
			</form>
		</main>
	);
}

function TicketsPage() {
	const { user } = useAuth();
	const [data, setData] = useState(null);
	const [error, setError] = useState("");
	const [filters, setFilters] = useState({ status: "", priority: "" });
	const [form, setForm] = useState({
		title: "",
		description: "",
		category: "software",
		priority: "media",
	});
	async function load() {
		const query = new URLSearchParams({ pageSize: "12" });
		if (filters.status) query.set("status", filters.status);
		if (filters.priority) query.set("priority", filters.priority);
		try {
			setData(await ticketApi.list(query.toString()));
		} catch (requestError) {
			setError(requestError.message);
		}
	}
	useEffect(() => {
		load();
	}, [filters]);
	async function create(event) {
		event.preventDefault();
		await ticketApi.create(form);
		setForm({
			title: "",
			description: "",
			category: "software",
			priority: "media",
		});
		load();
	}
	return (
		<>
			<section className="intro">
				<div>
					<p className="eyebrow">VISTA GENERAL</p>
					<h2>Tickets que necesitan atención</h2>
					<p>
						Consulta el estado de tus solicitudes y conserva el contexto de cada
						conversación.
					</p>
				</div>
				<span className="status-chip">Sesión activa</span>
			</section>
			<section className="workspace">
				<div className="ticket-column">
					<div className="toolbar">
						<strong>
							{data?.pagination.total ?? "—"}
							<span> incidencias</span>
						</strong>
						<div className="filters">
							<select
								aria-label="Estado"
								value={filters.status}
								onChange={(e) =>
									setFilters({ ...filters, status: e.target.value })
								}
							>
								<option value="">Todos los estados</option>
								<option value="abierto">Abierto</option>
								<option value="en_progreso">En progreso</option>
								<option value="resuelto">Resuelto</option>
								<option value="cerrado">Cerrado</option>
							</select>
							<select
								aria-label="Prioridad"
								value={filters.priority}
								onChange={(e) =>
									setFilters({ ...filters, priority: e.target.value })
								}
							>
								<option value="">Todas las prioridades</option>
								<option value="critica">Crítica</option>
								<option value="alta">Alta</option>
								<option value="media">Media</option>
								<option value="baja">Baja</option>
							</select>
						</div>
					</div>
					{error && <p className="form-error">{error}</p>}
					{!data && !error && (
						<p className="empty-state">Cargando incidencias...</p>
					)}
					<div className="ticket-list">
						{data?.items.map((ticket) => (
							<Link
								className="ticket-row"
								to={`/tickets/${ticket._id}`}
								key={ticket._id}
							>
								<div>
									<span
										className={`priority-dot priority-${ticket.priority}`}
									></span>
									<strong>{ticket.title}</strong>
									<p>{ticket.description}</p>
								</div>
								<div className="ticket-meta">
									<span>{ticket.category}</span>
									<span>{ticket.status.replace("_", " ")}</span>
								</div>
							</Link>
						))}
					</div>
				</div>
				{user.role === "cliente" && (
					<form className="create-panel" onSubmit={create}>
						<p className="eyebrow">NUEVA SOLICITUD</p>
						<h2>Crear incidencia</h2>
						<label>
							Título
							<input
								required
								minLength="3"
								value={form.title}
								onChange={(e) => setForm({ ...form, title: e.target.value })}
							/>
						</label>
						<label>
							Descripción
							<textarea
								required
								minLength="10"
								rows="5"
								value={form.description}
								onChange={(e) =>
									setForm({ ...form, description: e.target.value })
								}
							></textarea>
						</label>
						<div className="form-grid">
							<label>
								Categoría
								<select
									value={form.category}
									onChange={(e) =>
										setForm({ ...form, category: e.target.value })
									}
								>
									<option value="hardware">Hardware</option>
									<option value="software">Software</option>
									<option value="red">Red</option>
									<option value="cuenta">Cuenta</option>
									<option value="otro">Otro</option>
								</select>
							</label>
							<label>
								Prioridad
								<select
									value={form.priority}
									onChange={(e) =>
										setForm({ ...form, priority: e.target.value })
									}
								>
									<option value="baja">Baja</option>
									<option value="media">Media</option>
									<option value="alta">Alta</option>
									<option value="critica">Crítica</option>
								</select>
							</label>
						</div>
						<button className="primary-button">Enviar incidencia</button>
					</form>
				)}
			</section>
		</>
	);
}

function DetailPage() {
	const { id } = useParams();
	const { user } = useAuth();
	const [ticket, setTicket] = useState(null);
	const [body, setBody] = useState("");
	const [internal, setInternal] = useState(false);
	const [error, setError] = useState("");
	const [actionError, setActionError] = useState("");
	async function load() {
		try {
			const result = await ticketApi.get(id);
			setTicket(result.ticket);
		} catch (requestError) {
			setError(requestError.message);
		}
	}
	useEffect(() => {
		load();
	}, [id]);
	async function comment(event) {
		event.preventDefault();
		await ticketApi.addComment(id, { body, internal });
		setBody("");
		setInternal(false);
		load();
	}
	async function changeStatus(status) {
		setActionError("");
		try {
			await ticketApi.changeStatus(id, status);
			load();
		} catch (requestError) {
			setActionError(requestError.message);
		}
	}
	async function assign() {
		setActionError("");
		try {
			await ticketApi.assign(id);
			load();
		} catch (requestError) {
			setActionError(requestError.message);
		}
	}
	if (error) return <p className="form-error">{error}</p>;
	if (!ticket) return <p className="empty-state">Cargando detalle...</p>;
	return (
		<section className="detail-layout">
			<div>
				<Link className="back-link" to="/tickets">
					← Volver a tickets
				</Link>
				<p className="eyebrow">DETALLE DE INCIDENCIA</p>
				<h2>{ticket.title}</h2>
				<p>{ticket.description}</p>
				<div className="detail-meta">
					<span>{ticket.category}</span>
					<span>{ticket.priority}</span>
					<span>{ticket.status.replace("_", " ")}</span>
				</div>
				{actionError && <p className="form-error">{actionError}</p>}
				<div className="detail-actions">
					{user.role === "agente" && !ticket.assignedAgent && (
						<button className="secondary-button" onClick={assign}>
							Autoasignarme
						</button>
					)}
					{user.role === "agente" && ticket.status === "abierto" && (
						<button
							className="secondary-button"
							onClick={() => changeStatus("en_progreso")}
						>
							Empezar trabajo
						</button>
					)}
					{user.role === "agente" && ticket.status === "en_progreso" && (
						<button
							className="secondary-button"
							onClick={() => changeStatus("resuelto")}
						>
							Marcar resuelto
						</button>
					)}
					{user.role === "cliente" && ticket.status === "resuelto" && (
						<>
							<button
								className="secondary-button"
								onClick={() => changeStatus("cerrado")}
							>
								Cerrar ticket
							</button>
							<button
								className="secondary-button"
								onClick={() => changeStatus("abierto")}
							>
								Reabrir
							</button>
						</>
					)}
				</div>
				<h3>Historial de estados</h3>
				<ul className="history-list">
					{ticket.history.map((item) => (
						<li key={item._id}>
							<strong>{item.toStatus}</strong>
							<span>{item.changedBy.name}</span>
						</li>
					))}
				</ul>
			</div>
			<div className="create-panel">
				<h3>Conversación</h3>
				<div className="comments">
					{ticket.comments.map((comment) => (
						<article
							className={comment.internal ? "comment internal" : "comment"}
							key={comment._id}
						>
							<strong>{comment.author.name}</strong>
							<p>{comment.body}</p>
							{comment.internal && <small>Nota interna</small>}
						</article>
					))}
				</div>
				<form onSubmit={comment}>
					<label>
						Mensaje
						<textarea
							required
							minLength="1"
							rows="4"
							value={body}
							onChange={(e) => setBody(e.target.value)}
						></textarea>
					</label>
					{user.role === "agente" && (
						<label className="checkbox-label">
							<input
								type="checkbox"
								checked={internal}
								onChange={(e) => setInternal(e.target.checked)}
							/>{" "}
							Nota interna
						</label>
					)}
					<button className="primary-button">Comentar</button>
				</form>
			</div>
		</section>
	);
}

function MetricsPage() {
	const [stats, setStats] = useState(null);
	useEffect(() => {
		ticketApi.stats().then(setStats);
	}, []);
	if (!stats) return <p className="empty-state">Cargando métricas...</p>;
	return (
		<section className="metrics-grid">
			<div className="metric-panel chart-panel">
				<p className="eyebrow">ESTADOS</p>
				<h2>Tickets por estado</h2>
				<ResponsiveContainer width="100%" height={230}>
					<BarChart data={stats.byStatus}>
						<CartesianGrid strokeDasharray="3 3" stroke="#d7ded5" />
						<XAxis dataKey="status" />
						<YAxis allowDecimals={false} />
						<Tooltip />
						<Bar dataKey="count" fill="#d65b3f" />
					</BarChart>
				</ResponsiveContainer>
			</div>
			<div className="metric-panel chart-panel">
				<p className="eyebrow">PRIORIDADES</p>
				<h2>Atención requerida</h2>
				<ResponsiveContainer width="100%" height={230}>
					<BarChart data={stats.byPriority}>
						<CartesianGrid strokeDasharray="3 3" stroke="#d7ded5" />
						<XAxis dataKey="priority" />
						<YAxis allowDecimals={false} />
						<Tooltip />
						<Bar dataKey="count" fill="#28646b" />
					</BarChart>
				</ResponsiveContainer>
			</div>
			<div className="metric-panel">
				<p className="eyebrow">RESOLUCIÓN</p>
				<h2>Tiempo medio</h2>
				<strong className="metric-big">
					{stats.resolution.averageMs
						? `${Math.round(stats.resolution.averageMs / 3600000)} h`
						: "Sin datos"}
				</strong>
				<p>{stats.resolution.resolvedCount} tickets resueltos</p>
			</div>
			<div className="metric-panel">
				<p className="eyebrow">CARGA</p>
				<h2>Trabajo por agente</h2>
				{stats.workload.map((item) => (
					<div className="metric-line" key={item.agentId}>
						<span>{item.name}</span>
						<strong>{item.activeTickets}</strong>
					</div>
				))}
			</div>
		</section>
	);
}

function UsersPage() {
	const [users, setUsers] = useState([]);
	useEffect(() => {
		usersApi.list().then(({ users: data }) => setUsers(data));
	}, []);
	async function update(user, data) {
		const result = await usersApi.update(user._id, data);
		setUsers(
			users.map((item) => (item._id === result.user._id ? result.user : item)),
		);
	}
	return (
		<section className="users-panel">
			<p className="eyebrow">ADMINISTRACIÓN</p>
			<h2>Usuarios</h2>
			{users.map((user) => (
				<div className="user-row" key={user._id}>
					<div>
						<strong>{user.name}</strong>
						<span>{user.email}</span>
						<select
							aria-label={`Rol de ${user.name}`}
							value={user.role}
							onChange={(event) => update(user, { role: event.target.value })}
						>
							<option value="cliente">Cliente</option>
							<option value="agente">Agente</option>
							<option value="admin">Administrador</option>
						</select>
					</div>
					<button
						className="text-button"
						onClick={() => update(user, { active: !user.active })}
					>
						{user.active ? "Desactivar" : "Activar"}
					</button>
				</div>
			))}
		</section>
	);
}

function AppContent() {
	const { user } = useAuth();
	return (
		<Routes>
			<Route path="/login" element={<LoginPage />} />
			<Route
				path="/tickets"
				element={
					<ProtectedRoute>
						<Layout>
							<TicketsPageAdvanced user={user} />
						</Layout>
					</ProtectedRoute>
				}
			/>
			<Route
				path="/tickets/:id"
				element={
					<ProtectedRoute>
						<Layout>
							<DetailPage />
						</Layout>
					</ProtectedRoute>
				}
			/>
			<Route
				path="/metricas"
				element={
					<ProtectedRoute roles={["agente", "admin"]}>
						<Layout>
							<MetricsPage />
						</Layout>
					</ProtectedRoute>
				}
			/>
			<Route
				path="/usuarios"
				element={
					<ProtectedRoute roles={["admin"]}>
						<Layout>
							<UsersPage />
						</Layout>
					</ProtectedRoute>
				}
			/>
			<Route path="*" element={<Navigate to="/tickets" replace />} />
		</Routes>
	);
}

export default function AppRoutes() {
	return (
		<BrowserRouter>
			<AuthProvider>
				<AppContent />
			</AuthProvider>
		</BrowserRouter>
	);
}
