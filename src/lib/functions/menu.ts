
import { call } from './call';
import { Item, ModifierGroup, Category } from '@/types';

type Entity = 'category' | 'item' | 'modifier_group';

type UpsertPayload<T> = {
    entity: Entity,
    data: Partial<T> & { id?: string }
}

export const adminUpsertMenuEntity = (data: UpsertPayload<Item | ModifierGroup | Category>) =>
    call<{ ok: boolean, id: string }, any>('adminUpsertMenuEntities', data);
