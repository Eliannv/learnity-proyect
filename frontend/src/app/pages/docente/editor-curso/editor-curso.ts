import { Component, OnInit, computed, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { CATEGORIAS, MODULOS_EDITOR, VERIFICACION_ENVIO, iconoLeccion } from '../../../data/datos-demo';
import { EstadoCursoBadge } from '../../../shared/ui/estado-curso';
import { Modal } from '../../../shared/ui/modal';

type TipoSubida = 'VIDEO' | 'PDF' | 'PPT';

interface ArchivoRevisado {
  nombre: string;
  detalle: string;
  errores: string[];
}

/** Límites de la plataforma (RN-08). */
const LIMITES: Record<TipoSubida, { bytes: number; texto: string; acepta: string; titulo: string }> = {
  VIDEO: { bytes: 5 * 1024 * 1024, texto: 'MP4 (H.264) · máximo 5 MB · resolución máxima 480p', acepta: 'video/mp4', titulo: 'Subir video de la lección' },
  PDF: { bytes: 10 * 1024 * 1024, texto: 'PDF · máximo 10 MB', acepta: 'application/pdf,.pdf', titulo: 'Subir documento PDF' },
  PPT: { bytes: 10 * 1024 * 1024, texto: 'PowerPoint (.ppt o .pptx) · máximo 10 MB', acepta: '.ppt,.pptx', titulo: 'Subir presentación PowerPoint' },
};

const EJEMPLO_RECHAZADO: ArchivoRevisado = {
  nombre: 'clase-variables.mp4',
  detalle: '7,2 MB · 1280 × 720 · 3:10',
  errores: ['El video pesa 7,2 MB y el máximo permitido es 5 MB.', 'La resolución es 720p y la máxima permitida es 480p.'],
};

@Component({
  selector: 'app-editor-curso',
  imports: [FormsModule, RouterLink, LucideAngularModule, EstadoCursoBadge, Modal],
  templateUrl: './editor-curso.html',
  styleUrl: './editor-curso.scss',
})
export class EditorCurso implements OnInit {
  /** :id de /docente/cursos/:id/editar ("nuevo" para crear un curso). */
  readonly id = input.required<string>();

  protected readonly esNuevo = computed(() => this.id() === 'nuevo');
  protected readonly categorias = CATEGORIAS;
  protected readonly verificacion = VERIFICACION_ENVIO;
  protected readonly icono = iconoLeccion;
  protected readonly modulos = computed(() => (this.esNuevo() ? [] : MODULOS_EDITOR));
  protected readonly abiertos = signal<number[]>([0, 1]);

  protected titulo = 'JavaScript para la web';
  protected descripcion =
    'Aprende los fundamentos de Python paso a paso, con videos cortos, documentos de apoyo y evaluaciones por módulo.';
  protected categoria = 'Programación';
  protected nivel = 'Principiante';

  // ---- subida de archivos (validación en el navegador, como en el diagrama de secuencia 9.3)
  protected readonly subida = signal<TipoSubida | null>(null);
  protected readonly archivo = signal<ArchivoRevisado | null>(null);
  protected readonly limite = computed(() => (this.subida() ? LIMITES[this.subida()!] : null));

  ngOnInit() {
    if (this.esNuevo()) {
      this.titulo = '';
      this.descripcion = '';
    }
  }

  protected alternar(i: number) {
    this.abiertos.update((a) => (a.includes(i) ? a.filter((n) => n !== i) : [...a, i]));
  }

  protected abrirSubida(tipo: TipoSubida, mostrarEjemplo = false) {
    this.subida.set(tipo);
    this.archivo.set(mostrarEjemplo ? EJEMPLO_RECHAZADO : null);
  }

  protected cerrarSubida() {
    this.subida.set(null);
    this.archivo.set(null);
  }

  protected async revisarArchivo(evento: Event) {
    const entrada = evento.target as HTMLInputElement;
    const archivo = entrada.files?.[0];
    entrada.value = '';
    const tipo = this.subida();
    if (!archivo || !tipo) return;

    const limite = LIMITES[tipo];
    const errores: string[] = [];
    const mb = (archivo.size / 1024 / 1024).toFixed(1).replace('.', ',');
    const partes = [`${mb} MB`];

    const extension = archivo.name.split('.').pop()?.toLowerCase() ?? '';
    const extensionValida = tipo === 'VIDEO' ? extension === 'mp4' : tipo === 'PDF' ? extension === 'pdf' : ['ppt', 'pptx'].includes(extension);
    if (!extensionValida) errores.push(`El formato .${extension} no está permitido. Usa ${limite.texto.split(' · ')[0]}.`);
    if (archivo.size > limite.bytes) {
      errores.push(`El archivo pesa ${mb} MB y el máximo permitido es ${limite.bytes / 1024 / 1024} MB.`);
    }

    if (tipo === 'VIDEO' && extensionValida) {
      const meta = await leerVideo(archivo);
      if (meta) {
        partes.push(`${meta.ancho} × ${meta.alto}`, meta.duracion);
        if (meta.alto > 480) errores.push(`La resolución es ${meta.alto}p y la máxima permitida es 480p.`);
      }
    }

    this.archivo.set({ nombre: archivo.name, detalle: partes.join(' · '), errores });
  }
}

/** Lee ancho, alto y duración de un video sin subirlo. */
function leerVideo(archivo: File): Promise<{ ancho: number; alto: number; duracion: string } | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(archivo);
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.onloadedmetadata = () => {
      const s = Math.round(video.duration);
      resolve({ ancho: video.videoWidth, alto: video.videoHeight, duracion: `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` });
      URL.revokeObjectURL(url);
    };
    video.onerror = () => {
      resolve(null);
      URL.revokeObjectURL(url);
    };
    video.src = url;
  });
}
