
import { SettingsForm } from '@/components/forms/SettingsForm';
import { Settings as SettingsIcon } from 'lucide-react';

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold flex items-center gap-2">
        <SettingsIcon className="h-8 w-8" />
        应用设置
      </h1>
      <SettingsForm />
    </div>
  );
}
