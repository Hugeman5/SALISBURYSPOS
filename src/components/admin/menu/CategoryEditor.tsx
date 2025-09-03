
'use client';

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Category } from "@/types";

interface CategoryEditorProps {
    category: Category & { type: 'category' };
    onFormChange: (field: string, value: any) => void;
}

export function CategoryEditor({ category, onFormChange }: CategoryEditorProps) {
    return (
        <div className="space-y-4">
            <div>
                <Label>Category Name</Label>
                <Input value={category.name} onChange={e => onFormChange('name', e.target.value)} />
            </div>
            <div className="flex items-center space-x-2">
                <Switch id="cat-active" checked={category.active} onCheckedChange={c => onFormChange('active', c)} />
                <Label htmlFor="cat-active">Active</Label>
            </div>
        </div>
    );
}
