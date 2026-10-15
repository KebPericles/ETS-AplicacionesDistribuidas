import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import AppRoutes, { AuthContext, LoginPage, ProtectedRoute } from './AppRoutes'

function renderWithAuth(ui, value, initialEntries = ['/']) {
  return render(<AuthContext.Provider value={value}><MemoryRouter initialEntries={initialEntries}>{ui}</MemoryRouter></AuthContext.Provider>)
}

describe('HelpDesk frontend', () => {
  it('muestra y valida el formulario de acceso', async () => {
    const login = vi.fn().mockRejectedValue(new Error('Credenciales invalidas'))
    renderWithAuth(<LoginPage />, { user: null, login, register: vi.fn() })
    expect(screen.getByText('Bienvenido')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Entrar al panel' }))
    expect(login).not.toHaveBeenCalled()
    fireEvent.change(screen.getByLabelText('Correo electrónico'), { target: { value: 'ana@example.com' } })
    fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: 'password-segura' } })
    fireEvent.click(screen.getByRole('button', { name: 'Entrar al panel' }))
    await waitFor(() => expect(login).toHaveBeenCalledWith({ name: '', email: 'ana@example.com', password: 'password-segura' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Credenciales invalidas')
  })

  it('muestra la carga de una ruta protegida', () => {
    renderWithAuth(<ProtectedRoute><div>Privado</div></ProtectedRoute>, { user: null, loading: true })
    expect(screen.getByText('Cargando sesión...')).toBeInTheDocument()
  })

  it('redirige a usuarios sin el rol permitido', async () => {
    renderWithAuth(<ProtectedRoute roles={['admin']}><div>Administración privada</div></ProtectedRoute>, { user: { role: 'cliente' }, loading: false }, ['/usuarios'])
    await waitFor(() => expect(screen.queryByText('Administración privada')).not.toBeInTheDocument())
  })

  it('monta la entrada real después de consultar la sesión', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: false, status: 401, json: async () => ({ error: { message: 'Sin sesión' } }) })
    render(<AppRoutes />)
    expect(screen.getByText('Cargando sesión...')).toBeInTheDocument()
    expect(await screen.findByText('Bienvenido')).toBeInTheDocument()
  })
})
