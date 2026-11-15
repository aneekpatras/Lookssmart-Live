import { router } from '@inertiajs/react';
import * as React from 'react';

import { Button } from '@/Components/ui/button';
import { Textarea } from '@/Components/ui/textarea';

/**
 * One editable WhatsApp message template (plain text, up to 600 characters) with a live preview, Save and
 * "Reset to default". Shared by the Reminders and Follow-ups pages. Saving an empty value restores the default.
 */
export function MessageTemplateEditor({
  id,
  label,
  value,
  defaultValue,
  saveUrl,
  payloadKey,
  placeholders,
  preview,
}: {
  id: string;
  label: string;
  value: string;
  defaultValue: string;
  saveUrl: string;
  payloadKey: string;
  placeholders: string[];
  preview: (text: string) => string;
}) {
  const [text, setText] = React.useState(value);

  function save(next: string) {
    router.post(saveUrl, { key: payloadKey, value: next }, { preserveScroll: true });
  }

  return (
    <div className="space-y-2">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <Textarea
        id={id}
        rows={4}
        maxLength={600}
        value={text}
        onChange={(event) => setText(event.target.value)}
      />
      <p className="text-ink-muted text-xs">
        Placeholders: {placeholders.map((name) => `{${name}}`).join(' ')}. Plain text, up to 600
        characters ({text.length}).
      </p>
      <p className="bg-accent-50 rounded-md p-3 text-sm">
        <span className="text-ink-muted block text-xs">Preview</span>
        {preview(text)}
      </p>
      <div className="flex gap-2">
        <Button type="button" size="sm" onClick={() => save(text)} disabled={text === value}>
          Save template
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => {
            setText(defaultValue);
            save('');
          }}
        >
          Reset to default
        </Button>
      </div>
    </div>
  );
}
