import { useEffect, useState } from 'react'
import { authApi, ticketApi } from './api'
import './App.css'

function App() {
  const [user, setUser] = useState(null)
  const [sessionState, setSessionState] = useState('loading')
  const [authMode, setAuthMode] = useState('login')
  const [authError, setAuthError] = useState('')
  const [tickets, setTickets] = useState(null)
  const [ticketError, setTicketError] = useState('')
  const [filters, setFilters] = useState({ status: '', priority: '' })
  const [form, setForm] = useState({ email: '', password: '', name: '' })
  const [ticketForm, setTicketForm] = useState({ title: '', description: '', category: 'software', priority: 'media' })
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    authApi.me()
      .then(({ user: currentUser }) => {
        setUser(currentUser)
        setSessionState('ready')
      })
      .catch(() => setSessionState('ready'))
  }, [])

  useEffect(() => {
    if (!user) return
    const query = new URLSearchParams({ pageSize: '8' })
    if (filters.status) query.set('status', filters.status)
    if (filters.priority) query.set('priority', filters.priority)
    setTicketError('')
    ticketApi.list(query.toString()).then(setTickets).catch((error) => setTicketError(error.message))
  }, [user, filters])

  async function handleAuth(event) {
    event.preventDefault()
    setAuthError('')
    try {
      const data = authMode === 'login' ? await authApi.login(form) : await authApi.register(form)
      if (authMode === 'register') {
        await authApi.login({ email: form.email, password: form.password })
      }
      setUser(data.user)
    } catch (error) {
      setAuthError(error.message)
    }
  }

  async function handleCreateTicket(event) {
    event.preventDefault()
    setCreating(true)
    try {
      await ticketApi.create(ticketForm)
      setTicketForm({ title: '', description: '', category: 'software', priority: 'media' })
      const query = new URLSearchParams({ pageSize: '8' })
      if (filters.status) query.set('status', filters.status)
      if (filters.priority) query.set('priority', filters.priority)
      setTickets(await ticketApi.list(query.toString()))
    } catch (error) {
      setTicketError(error.message)
    } finally {
      setCreating(false)
    }
  }

  async function handleLogout() {
    await authApi.logout()
    setUser(null)
    setTickets(null)
  }

  if (sessionState === 'loading') return <main className="loading-screen">Cargando sesión...</main>
  if (!user) {
    return (
      <main className="auth-shell">
        <section className="auth-copy">
          <p className="eyebrow">HELPDESK / OPERACIONES</p>
          <h1>El trabajo técnico, en orden.</h1>
          <p>Gestiona incidencias, prioridades y respuestas desde un único lugar.</p>
        </section>
        <form className="auth-panel" onSubmit={handleAuth}>
          <div className="panel-heading"><span>Acceso seguro</span><strong>{authMode === 'login' ? 'Bienvenido' : 'Crear cuenta'}</strong></div>
          {authMode === 'register' && <label>Nombre<input required minLength="2" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label>}
          <label>Correo electrónico<input required type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></label>
          <label>Contraseña<input required minLength="8" type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} /></label>
          {authError && <p className="form-error" role="alert">{authError}</p>}
          <button className="primary-button" type="submit">{authMode === 'login' ? 'Entrar al panel' : 'Registrarme'}</button>
          <button className="text-button" type="button" onClick={() => { setAuthMode(authMode === 'login' ? 'register' : 'login'); setAuthError('') }}>
            {authMode === 'login' ? 'Necesito una cuenta' : 'Ya tengo una cuenta'}
          </button>
        </form>
      </main>
    )
  }

  return (
    <main className="app-shell">
      <header className="topbar"><div><p className="eyebrow">HELPDESK / OPERACIONES</p><h1>Centro de incidencias</h1></div><div className="profile"><span>{user.name}</span><small>{user.role}</small><button className="text-button" onClick={handleLogout}>Salir</button></div></header>
      <section className="intro"><div><p className="eyebrow">VISTA GENERAL</p><h2>Tickets que necesitan atención</h2><p>Consulta el estado de tus solicitudes y mantén el contexto de cada conversación.</p></div><span className="status-chip">Sesión activa</span></section>
      <section className="workspace">
        <div className="ticket-column">
          <div className="toolbar"><div><strong>{tickets?.pagination.total ?? '—'}</strong><span> incidencias</span></div><div className="filters"><select aria-label="Filtrar por estado" value={filters.status} onChange={(event) => setFilters({ ...filters, status: event.target.value })}><option value="">Todos los estados</option><option value="abierto">Abierto</option><option value="en_progreso">En progreso</option><option value="resuelto">Resuelto</option><option value="cerrado">Cerrado</option></select><select aria-label="Filtrar por prioridad" value={filters.priority} onChange={(event) => setFilters({ ...filters, priority: event.target.value })}><option value="">Todas las prioridades</option><option value="critica">Crítica</option><option value="alta">Alta</option><option value="media">Media</option><option value="baja">Baja</option></select></div></div>
          {ticketError && <p className="form-error" role="alert">{ticketError}</p>}
          {!tickets && !ticketError && <p className="empty-state">Cargando incidencias...</p>}
          {tickets?.items.length === 0 && <p className="empty-state">No hay incidencias con estos filtros.</p>}
          <div className="ticket-list">{tickets?.items.map((ticket) => <article className="ticket-row" key={ticket._id}><div><span className={`priority-dot priority-${ticket.priority}`}></span><strong>{ticket.title}</strong><p>{ticket.description}</p></div><div className="ticket-meta"><span>{ticket.category}</span><span>{ticket.status.replace('_', ' ')}</span></div></article>)}</div>
        </div>
        {user.role === 'cliente' && <form className="create-panel" onSubmit={handleCreateTicket}><p className="eyebrow">NUEVA SOLICITUD</p><h2>Crear incidencia</h2><label>Título<input required minLength="3" value={ticketForm.title} onChange={(event) => setTicketForm({ ...ticketForm, title: event.target.value })} /></label><label>Descripción<textarea required minLength="10" rows="5" value={ticketForm.description} onChange={(event) => setTicketForm({ ...ticketForm, description: event.target.value })}></textarea></label><div className="form-grid"><label>Categoría<select value={ticketForm.category} onChange={(event) => setTicketForm({ ...ticketForm, category: event.target.value })}><option value="hardware">Hardware</option><option value="software">Software</option><option value="red">Red</option><option value="cuenta">Cuenta</option><option value="otro">Otro</option></select></label><label>Prioridad<select value={ticketForm.priority} onChange={(event) => setTicketForm({ ...ticketForm, priority: event.target.value })}><option value="baja">Baja</option><option value="media">Media</option><option value="alta">Alta</option><option value="critica">Crítica</option></select></label></div><button className="primary-button" disabled={creating} type="submit">{creating ? 'Creando...' : 'Enviar incidencia'}</button></form>}
      </section>
    </main>
  )
}

export default App
