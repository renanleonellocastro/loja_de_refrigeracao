<script setup lang="ts">
import { THEME_OPTIONS } from '~/utils/theme';
import { ROLE_LABELS } from '@rc/contracts';
import { ChevronDown, LogOut, UserRound } from 'lucide-vue-next';
import {
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuPortal,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuRoot,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from 'reka-ui';

/** Account menu of the top bar: who is signed in, profile, theme and sign out. */
const actor = useCurrentActor();
const auth = useAuthStore();
const toast = useToast();
const { preference, setPreference } = useTheme();
const roleLabel = computed(() => ROLE_LABELS[actor.value]);
// The style guide preview has no person, only a role.
const displayName = computed(() => auth.user?.name ?? roleLabel.value);
const subtitle = computed(() => (auth.user ? roleLabel.value : 'Refrigeração Castro'));

async function signOut(): Promise<void> {
  await auth.logout();
  toast.success({ title: 'Você saiu da sua conta. Até logo!' });
  await navigateTo('/');
}

const theme = computed({
  get: () => preference.value,
  set: (value: ThemePreference) => setPreference(value),
});

const ITEM =
  'flex min-h-11 cursor-pointer items-center gap-3 rounded-md px-3 text-sm font-medium text-text outline-none select-none data-[highlighted]:bg-info-soft data-[highlighted]:text-on-info-soft data-[disabled]:pointer-events-none data-[disabled]:opacity-50';
</script>

<template>
  <DropdownMenuRoot :modal="false">
    <DropdownMenuTrigger
      class="flex h-11 items-center gap-2 rounded-full pr-2 pl-1 transition-colors hover:bg-surface-sunken data-[state=open]:bg-surface-sunken"
      aria-label="Menu da conta"
    >
      <BaseAvatar :name="displayName" size="sm" />
      <span class="hidden max-w-40 truncate text-sm font-semibold text-text lg:block">{{ displayName }}</span>
      <ChevronDown class="hidden size-4 text-text-muted lg:block" aria-hidden="true" />
    </DropdownMenuTrigger>
    <DropdownMenuPortal>
      <DropdownMenuContent
        align="end"
        :side-offset="8"
        class="z-50 w-64 rounded-lg border border-border bg-surface-raised p-1.5 shadow-lg data-[state=open]:animate-rc-rise"
      >
        <DropdownMenuLabel class="flex items-center gap-3 px-3 py-2.5">
          <BaseAvatar :name="displayName" />
          <span class="flex min-w-0 flex-col">
            <span class="truncate font-semibold text-text">{{ displayName }}</span>
            <span class="text-xs text-text-muted">{{ subtitle }}</span>
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator class="my-1 h-px bg-border" />
        <DropdownMenuItem as-child :class="ITEM">
          <NuxtLink to="/perfil"><UserRound class="size-4.5" aria-hidden="true" />Meu perfil</NuxtLink>
        </DropdownMenuItem>
        <DropdownMenuSeparator class="my-1 h-px bg-border" />
        <DropdownMenuLabel
          class="px-3 pt-1.5 pb-1 text-xs font-semibold tracking-wide text-text-muted uppercase"
        >
          Tema
        </DropdownMenuLabel>
        <DropdownMenuRadioGroup v-model="theme">
          <DropdownMenuRadioItem
            v-for="option in THEME_OPTIONS"
            :key="option.value"
            :value="option.value"
            :class="[ITEM, 'data-[state=checked]:font-semibold data-[state=checked]:text-link']"
          >
            <span
              class="flex size-4 items-center justify-center rounded-full border-2 border-current"
              aria-hidden="true"
            >
              <span class="size-1.5 rounded-full bg-current opacity-0 in-data-[state=checked]:opacity-100" />
            </span>
            {{ option.label }}
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator class="my-1 h-px bg-border" />
        <DropdownMenuItem :disabled="!auth.signedIn" :class="ITEM" @select="signOut">
          <LogOut class="size-4.5" aria-hidden="true" />
          Sair
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenuPortal>
  </DropdownMenuRoot>
</template>
