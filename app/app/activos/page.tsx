import type { Metadata } from 'next';
import { ConsoleShell } from '@/components/layout/console-shell';
import { ActivosContent } from '@/components/activos/activos-content';

export const metadata: Metadata = {
  title: 'Inventario de Activos Fijos - ActivaCore UNAPEC',
  description:
    'Control de bienes institucionales, custodia departamental, clasificaciones fiscales DGII y actas de entrega.',
};

export default function ActivosPage() {
  return (
    <ConsoleShell>
      <ActivosContent />
    </ConsoleShell>
  );
}
