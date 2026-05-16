import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { PageHeader } from '@renderer/components/PageHeader'
import { Button } from '@renderer/components/ui/Button'
import { Field, Input, Select, Textarea } from '@renderer/components/ui/Field'
import type { PatientInput, Sex } from '@shared/types'
import { validatePatient } from '@shared/validators'

const EMPTY: PatientInput = {
  fullName: '',
  cpf: '',
  cns: '',
  birthDate: '',
  sex: 'F',
  phone: '',
  email: '',
  motherName: '',
  race: '',
  addressStreet: '',
  addressNumber: '',
  addressComplement: '',
  addressNeighborhood: '',
  addressCity: '',
  addressState: '',
  addressZip: '',
  addressIbge: '',
  notes: ''
}

export function PatientFormPage(): React.JSX.Element {
  const { id } = useParams()
  const editing = Boolean(id)
  const navigate = useNavigate()
  const [form, setForm] = useState<PatientInput>(EMPTY)
  const [loading, setLoading] = useState(editing)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!editing) return
    let cancelled = false
    const load = async (): Promise<void> => {
      try {
        const patient = await window.api.patients.get(Number(id))
        if (!patient) throw new Error('Paciente não encontrado')
        if (cancelled) return
        const { id: _id, createdAt: _c, updatedAt: _u, ...rest } = patient
        void _id
        void _c
        void _u
        setForm({
          ...EMPTY,
          ...rest,
          cpf: rest.cpf ?? '',
          cns: rest.cns ?? '',
          phone: rest.phone ?? '',
          email: rest.email ?? '',
          motherName: rest.motherName ?? '',
          race: rest.race ?? '',
          addressStreet: rest.addressStreet ?? '',
          addressNumber: rest.addressNumber ?? '',
          addressComplement: rest.addressComplement ?? '',
          addressNeighborhood: rest.addressNeighborhood ?? '',
          addressCity: rest.addressCity ?? '',
          addressState: rest.addressState ?? '',
          addressZip: rest.addressZip ?? '',
          addressIbge: rest.addressIbge ?? '',
          notes: rest.notes ?? ''
        })
      } catch (err) {
        setError((err as Error).message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [editing, id])

  const update = <K extends keyof PatientInput>(key: K, value: PatientInput[K]): void => {
    setForm((f) => ({ ...f, [key]: value }))
  }

  const submit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    setError(null)
    const validationErrors = validatePatient({
      fullName: form.fullName,
      cpf: form.cpf,
      cns: form.cns,
      birthDate: form.birthDate
    })
    if (validationErrors.length > 0) {
      setError(validationErrors.map((v) => v.message).join(' '))
      return
    }
    setSaving(true)
    try {
      if (editing) {
        await window.api.patients.update(Number(id), form)
        navigate(`/pacientes/${id}`)
      } else {
        const created = await window.api.patients.create(form)
        navigate(`/pacientes/${created.id}`)
      }
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div className="p-6 text-sm text-slate-500">Carregando…</div>
  }

  return (
    <>
      <PageHeader
        title={editing ? 'Editar paciente' : 'Novo paciente'}
        subtitle="Dados cadastrais completos"
        actions={
          <Button variant="outline" onClick={() => navigate(-1)}>
            Cancelar
          </Button>
        }
      />
      <form onSubmit={submit} className="space-y-6 p-6">
        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold text-slate-700">Identificação</h2>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-6">
            <Field className="md:col-span-4" label="Nome completo" required>
              <Input
                value={form.fullName}
                onChange={(e) => update('fullName', e.target.value)}
                required
              />
            </Field>
            <Field className="md:col-span-2" label="Sexo" required>
              <Select value={form.sex} onChange={(e) => update('sex', e.target.value as Sex)}>
                <option value="F">Feminino</option>
                <option value="M">Masculino</option>
                <option value="O">Outro / Não informado</option>
              </Select>
            </Field>
            <Field className="md:col-span-2" label="Data de nascimento" required>
              <Input
                type="date"
                value={form.birthDate}
                onChange={(e) => update('birthDate', e.target.value)}
                required
              />
            </Field>
            <Field className="md:col-span-2" label="CPF">
              <Input
                value={form.cpf ?? ''}
                onChange={(e) => update('cpf', e.target.value.replace(/\D/g, ''))}
                maxLength={11}
                placeholder="Somente números"
              />
            </Field>
            <Field className="md:col-span-2" label="CNS (cartão SUS)">
              <Input
                value={form.cns ?? ''}
                onChange={(e) => update('cns', e.target.value.replace(/\D/g, ''))}
                maxLength={15}
              />
            </Field>
            <Field className="md:col-span-3" label="Nome da mãe">
              <Input
                value={form.motherName ?? ''}
                onChange={(e) => update('motherName', e.target.value)}
              />
            </Field>
            <Field className="md:col-span-3" label="Raça / Cor">
              <Select value={form.race ?? ''} onChange={(e) => update('race', e.target.value)}>
                <option value="">Não declarado</option>
                <option value="branca">Branca</option>
                <option value="preta">Preta</option>
                <option value="parda">Parda</option>
                <option value="amarela">Amarela</option>
                <option value="indigena">Indígena</option>
              </Select>
            </Field>
          </div>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold text-slate-700">Contato</h2>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-6">
            <Field className="md:col-span-3" label="Telefone">
              <Input
                value={form.phone ?? ''}
                onChange={(e) => update('phone', e.target.value)}
                placeholder="(11) 99999-9999"
              />
            </Field>
            <Field className="md:col-span-3" label="E-mail">
              <Input
                type="email"
                value={form.email ?? ''}
                onChange={(e) => update('email', e.target.value)}
              />
            </Field>
          </div>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold text-slate-700">Endereço</h2>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-6">
            <Field className="md:col-span-4" label="Logradouro">
              <Input
                value={form.addressStreet ?? ''}
                onChange={(e) => update('addressStreet', e.target.value)}
              />
            </Field>
            <Field className="md:col-span-2" label="Número">
              <Input
                value={form.addressNumber ?? ''}
                onChange={(e) => update('addressNumber', e.target.value)}
              />
            </Field>
            <Field className="md:col-span-3" label="Complemento">
              <Input
                value={form.addressComplement ?? ''}
                onChange={(e) => update('addressComplement', e.target.value)}
              />
            </Field>
            <Field className="md:col-span-3" label="Bairro">
              <Input
                value={form.addressNeighborhood ?? ''}
                onChange={(e) => update('addressNeighborhood', e.target.value)}
              />
            </Field>
            <Field className="md:col-span-3" label="Cidade">
              <Input
                value={form.addressCity ?? ''}
                onChange={(e) => update('addressCity', e.target.value)}
              />
            </Field>
            <Field className="md:col-span-1" label="UF">
              <Input
                maxLength={2}
                value={form.addressState ?? ''}
                onChange={(e) => update('addressState', e.target.value.toUpperCase().slice(0, 2))}
              />
            </Field>
            <Field className="md:col-span-2" label="CEP">
              <Input
                value={form.addressZip ?? ''}
                onChange={(e) => update('addressZip', e.target.value.replace(/\D/g, ''))}
              />
            </Field>
            <Field
              className="md:col-span-2"
              label="Código IBGE do município"
              hint="6 dígitos — usado em BPA/SUS"
            >
              <Input
                value={form.addressIbge ?? ''}
                onChange={(e) =>
                  update('addressIbge', e.target.value.replace(/\D/g, '').slice(0, 6))
                }
                placeholder="ex.: 292740 (Salvador-BA)"
              />
            </Field>
          </div>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold text-slate-700">Observações</h2>
          <Field label="Notas gerais">
            <Textarea
              rows={3}
              value={form.notes ?? ''}
              onChange={(e) => update('notes', e.target.value)}
            />
          </Field>
        </section>

        {error ? (
          <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-200">
            {error}
          </div>
        ) : null}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => navigate(-1)}>
            Cancelar
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? 'Salvando…' : editing ? 'Salvar alterações' : 'Cadastrar paciente'}
          </Button>
        </div>
      </form>
    </>
  )
}
