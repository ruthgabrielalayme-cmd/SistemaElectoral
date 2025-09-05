// src/pages/RegistroBoletasPage.jsx
import React, { useEffect, useState, useCallback } from 'react';
import { db, storage, auth } from '../firebaseConfig';
import {
    collection,
    getDocs,
    query,
    where,
    addDoc,
    serverTimestamp,
    doc,
    getDoc,
} from 'firebase/firestore';
import { onAuthStateChanged } from "firebase/auth";
import { ref, uploadBytes, getDownloadURL, getStorage, uploadBytesResumable } from 'firebase/storage';
import Loader from '../Loader';
import styles from './RegistroBoletasPage.module.css';
import Swal from 'sweetalert2';
import { FaSearch } from 'react-icons/fa'
import ClipLoader from 'react-spinners/ClipLoader';
import Cropper from 'react-easy-crop';
import getCroppedImg from '../utils/cropImage';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import PasoIndicador from './PasoIndicador';
import imageCompression from 'browser-image-compression';




const partidos = [
    'ALIANZA POPULAR (AP)',
    'LIBERTAD Y PROGRESO ADN (LYP-ADN)',
    'AUTONOMÍA PARA BOLIVIA SÚMATE (APB-SUMATE)',
    'LIBERTAD Y DEMOCRACIA (LIBRE)',
    'LA FUERZA DEL PUEBLO (FP)',
    'MAS-IPSP',
    'MORENA',
    'UNIDAD',
    'PARTIDO DEMOCRATA CRISTIANO (PDC)',
];

export default function RegistroBoletasPage() {
    const navigate = useNavigate();
    const [form, setForm] = useState({
        departamento: '',
        circunscripcion: '',
        provincia: '',
        municipio: '',
        recinto: '',
        nroMesa: '',
        votosPresidente: {},
        votosDiputado: {},
        validosPresidente: '',
        validosDiputado: '',
        blancosPresidente: '',
        blancosDiputado: '',
        nulosPresidente: '',
        nulosDiputado: '',         // nuevo
        papeletasAnfora: '',       // nuevo
        papeletasNoUtilizadas: '', // nuevo
        imagenActa: null,
        imagenHojaTrabajo: null,
        estado: '', // o 'observado'
    });
    const [previewActa, setPreviewActa] = useState(null);
    const [previewHoja, setPreviewHoja] = useState(null);

    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);

    const [departamentos, setDepartamentos] = useState([]);
    const [circunscripciones, setCircunscripciones] = useState([]);
    const [provincias, setProvincias] = useState([]);
    const [municipios, setMunicipios] = useState([]);
    const [recintos, setRecintos] = useState([]);
    // 👇 Aquí van los estados de búsqueda
    const [busquedaDepto, setBusquedaDepto] = useState('');
    const [busquedaCirc, setBusquedaCirc] = useState('');
    const [busquedaProv, setBusquedaProv] = useState('');
    const [busquedaMuni, setBusquedaMuni] = useState('');
    const [busquedaRecinto, setBusquedaRecinto] = useState('');
    const [mesasDisponibles, setMesasDisponibles] = useState([]);


    const [misBoletas, setMisBoletas] = useState([]);

    const [imagenActaSrc, setImagenActaSrc] = useState(null);
    const [imagenHojaSrc, setImagenHojaSrc] = useState(null);

    const [crop, setCrop] = useState({ x: 0, y: 0 });
    const [zoom, setZoom] = useState(1);
    const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);

    const [recortandoTipo, setRecortandoTipo] = useState(null); // 'acta' o 'hoja'
    const [userData, setUserData] = useState(null);
    const [usuarioActual, setUsuarioActual] = useState(null);
    const [sizeActa, setSizeActa] = React.useState(null);
    const [sizeHoja, setSizeHoja] = React.useState(null);

    // Cargar usuario actual y redirigir si no tiene permiso
    useEffect(() => {
        const cargarDatosUsuario = async () => {
            const uid = auth.currentUser?.uid;
            if (!uid) return navigate('/');

            const docSnap = await getDoc(doc(db, 'usuarios', uid));
            if (docSnap.exists()) {
                const data = docSnap.data();
                setUsuarioActual(data);

                // Redirigir si no es admin ni jefe de recinto
                if (data.rol !== 'administrador' && data.rol !== 'revisor' && data.rol !== 'delegado' && data.rol !== 'jefe_recinto') {
                    navigate('/');
                }
            } else {
                navigate('/');
            }
        };
        cargarDatosUsuario();
    }, [navigate, auth]);



    const handlePreview = (e, tipo) => {
        const file = e.target.files[0];
        if (!file) return;

        const sizeMB = (file.size / (1024 * 1024)).toFixed(2); // tamaño en MB con 2 decimales

        const reader = new FileReader();
        reader.onload = () => {
            if (tipo === 'acta') {
                setPreviewActa(reader.result);
                setImagenActaSrc(reader.result);
                setForm(prev => ({ ...prev, imagenActa: file }));
                setSizeActa(sizeMB); // guardar tamaño
            } else {
                setPreviewHoja(reader.result);
                setImagenHojaSrc(reader.result);
                setForm(prev => ({ ...prev, imagenHojaTrabajo: file }));
                setSizeHoja(sizeMB); // guardar tamaño
            }
        };
        reader.readAsDataURL(file);
    };


    ///////////-----------------
    const onCropComplete = useCallback((_, croppedArea) => {
        setCroppedAreaPixels(croppedArea);
    }, []);

    const iniciarRecorte = (tipo) => {
        setRecortandoTipo(tipo);
        setZoom(1);
        // Se puede centrar o dejar en último punto donde estuvo
        setCrop({ x: 0, y: 0 });
    };

    const urlToFile = async (dataUrl, filename) => {
        const res = await fetch(dataUrl);
        const blob = await res.blob();
        return new File([blob], filename, { type: blob.type });
    };

    const aplicarRecorte = async () => {
        const originalSrc =
            recortandoTipo === 'acta' ? imagenActaSrc : imagenHojaSrc;

        const resultado = await getCroppedImg(originalSrc, croppedAreaPixels);

        // ⚠ Si ya no quieres filtros, llama solo al recorte
        const fileFinal = await urlToFile(
            resultado,
            `${recortandoTipo}_${Date.now()}.jpg`
        );
        const sizeMB = (fileFinal.size / (1024 * 1024)).toFixed(2);

        if (recortandoTipo === 'acta') {
            setPreviewActa(resultado);
            setForm((prev) => ({ ...prev, imagenActa: fileFinal }));
            setSizeActa(sizeMB);
        } else {
            setPreviewHoja(resultado);
            setForm((prev) => ({ ...prev, imagenHojaTrabajo: fileFinal }));
            setSizeHoja(sizeMB);
        }

        setRecortandoTipo(null);
    };

    // Listener para detectar cambios en el estado de autenticación del usuario
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (user) {
                console.log('Usuario autenticado:', user.uid);
                // Cargar las boletas asociadas al usuario autenticado
                await cargarBoletasUsuario(user);
            } else {
                console.log('Usuario no autenticado');
                setMisBoletas([]); // Limpiar boletas si no hay usuario
            }
        });

        // Limpieza del listener cuando se desmonte el componente
        return () => unsubscribe();
    }, []); // Solo al montar el componente

    //cargar datos al form
    // ----------------- CARGA JERÁRQUICA SEGÚN userData Y RECINTO -----------------
    useEffect(() => {
        const cargarJerarquia = async () => {
            try {
                setLoading(true);

                let departamentoId, circunscripcionId, provinciaId, municipioId;

                if (userData?.rol === 'administrador' || userData?.rol === 'revisor') {
                    // Para admin y revisor, tomar IDs desde el form (selección manual)
                    departamentoId = form.departamento;
                    circunscripcionId = form.circunscripcion;
                    provinciaId = form.provincia;
                    municipioId = form.municipio;
                } else {
                    // Para otros roles, tomar IDs fijos desde userData
                    departamentoId = userData?.departamentoId;
                    circunscripcionId = userData?.circunscripcionId;
                    provinciaId = userData?.provinciaId;
                    municipioId = userData?.municipioId;

                    setForm(prev => ({
                        ...prev,
                        departamento: departamentoId,
                        circunscripcion: circunscripcionId,
                        provincia: provinciaId,
                        municipio: municipioId,
                        recinto: userData?.recintoId,
                    }));
                }

                // Cargar departamentos (todos)
                const departamentosSnap = await getDocs(collection(db, "departamentos"));
                setDepartamentos(departamentosSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));

                // Cargar circunscripciones filtradas si hay departamento
                if (departamentoId) {
                    const circSnap = await getDocs(
                        query(collection(db, "circunscripciones"), where("idDepartamento", "==", departamentoId))
                    );
                    setCircunscripciones(circSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
                } else {
                    setCircunscripciones([]);
                }

                // Cargar provincias filtradas si hay circunscripcion
                if (circunscripcionId) {
                    const provSnap = await getDocs(
                        query(collection(db, "provincias"), where("idCircunscripcion", "==", circunscripcionId))
                    );
                    setProvincias(provSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
                } else {
                    setProvincias([]);
                }

                // Cargar municipios filtrados si hay provincia
                if (provinciaId) {
                    const muniSnap = await getDocs(
                        query(collection(db, "municipios"), where("idProvincia", "==", provinciaId))
                    );
                    setMunicipios(muniSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
                } else {
                    setMunicipios([]);
                }

                // Cargar recintos filtrados si hay municipio
                if (municipioId) {
                    const recintoSnap = await getDocs(
                        query(collection(db, "recintos"), where("idMunicipio", "==", municipioId))
                    );
                    setRecintos(recintoSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
                } else {
                    setRecintos([]);
                }

            } catch (error) {
                console.error("Error cargando jerarquía:", error);
            } finally {
                setLoading(false);
            }
        };

        if (userData) {
            cargarJerarquia();
        }
    }, [userData, form.departamento, form.circunscripcion, form.provincia, form.municipio]);

    // ----------------- CARGA DE MESAS -----------------
    useEffect(() => {
        const cargarMesas = async () => {
            try {
                setLoading(true);

                const idRecinto = (userData?.rol === 'administrador' || userData?.rol === 'revisor')
                    ? form.recinto
                    : userData?.recintoId;
                if (!idRecinto) return;

                const mesasSnap = await getDocs(
                    query(collection(db, 'mesas'), where('idRecinto', '==', idRecinto))
                );

                const mesas = mesasSnap.docs
                    .map(doc => ({ id: doc.id, ...doc.data() }))
                    .sort((a, b) => parseInt(b.codigo) - parseInt(a.codigo));

                setMesasDisponibles(mesas);

            } catch (error) {
                console.error('Error al cargar mesas:', error);
            } finally {
                setLoading(false);
            }
        };

        if (userData && (userData.rol !== 'administrador' && userData.rol !== 'revisor' || form.recinto)) {
            cargarMesas();
        }
    }, [userData, form.recinto]);

    // Función para cargar boletas asociadas al usuario actual
    const cargarBoletasUsuario = async (user) => {
        try {
            const userDocRef = doc(db, 'usuarios', user.uid);
            const userSnap = await getDoc(userDocRef);

            if (!userSnap.exists()) {
                console.log('No existe documento usuario');
                setMisBoletas([]);
                return;
            }

            const data = userSnap.data();
            setUserData(data); // ⬅️ Guardamos los datos del usuario

            const esJefeRecinto = data.rol === 'jefe_recinto';
            const recintoId = data.recintoId;

            let boletasQuery;
            if (esJefeRecinto && recintoId) {
                boletasQuery = query(
                    collection(db, 'recepcion'),
                    where('recinto', '==', recintoId)
                );
            } else {
                boletasQuery = query(
                    collection(db, 'recepcion'),
                    where('idUsuarioRecepcion', '==', user.uid)
                );
            }

            const snap = await getDocs(boletasQuery);
            const dataBoletas = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            dataBoletas.sort((a, b) => parseInt(a.nroMesa) - parseInt(b.nroMesa));
            setMisBoletas(dataBoletas);

        } catch (error) {
            console.error('Error cargando registros del usuario:', error);
        }
    };


    // Función para mostrar advertencia con Swal
    const advertirSiInconsistente = (campo, votosTotales, papeletas) => {
        if (votosTotales > papeletas) {
            Swal.fire({
                icon: 'warning',
                title: `¡Advertencia en ${campo}!`,
                text: `La suma de votos (${votosTotales}) supera las papeletas en ánfora.`,
                confirmButtonText: 'Entendido',
                timer: 4000,
            });
        }
    };
    // Helper para setear color rojo si hay error, sino quitar color
    const marcarInputError = (inputName, tieneError) => {
        const input = document.querySelector(`[name="${inputName}"]`);
        if (input) {
            input.style.borderColor = tieneError ? 'red' : '';
        }
    };


    //calcular totales
    useEffect(() => {
        const totalPresidente = Object.values(form.votosPresidente || {}).reduce(
            (acc, val) => acc + (parseInt(val) || 0),
            0
        );

        const totalDiputado = Object.values(form.votosDiputado || {}).reduce(
            (acc, val) => acc + (parseInt(val) || 0),
            0
        );

        const blancosPresidente = parseInt(form.blancosPresidente) || 0;
        const nulosPresidente = parseInt(form.nulosPresidente) || 0;
        const totalCamposPresidente = totalPresidente + blancosPresidente + nulosPresidente;

        const blancosDiputado = parseInt(form.blancosDiputado) || 0;
        const nulosDiputado = parseInt(form.nulosDiputado) || 0;
        const totalCamposDiputado = totalDiputado + blancosDiputado + nulosDiputado;

        if (totalCamposPresidente > 300) {
            marcarInputError('validosPresidente', true);
            marcarInputError('blancosPresidente', true);
            marcarInputError('nulosPresidente', true);
            advertirSiInconsistente('Presidente', totalCamposPresidente, 300);
        } else {
            marcarInputError('validosPresidente', false);
            marcarInputError('blancosPresidente', false);
            marcarInputError('nulosPresidente', false);
        }

        if (totalCamposDiputado > 300) {
            marcarInputError('validosDiputado', true);
            marcarInputError('blancosDiputado', true);
            marcarInputError('nulosDiputado', true);
            advertirSiInconsistente('Diputado', totalCamposDiputado, 300);
        } else {
            marcarInputError('validosDiputado', false);
            marcarInputError('blancosDiputado', false);
            marcarInputError('nulosDiputado', false);
        }

        setForm(prev => ({
            ...prev,
            validosPresidente: totalPresidente.toString(),
            validosDiputado: totalDiputado.toString(),
        }));
    }, [
        form.votosPresidente,
        form.votosDiputado,
        form.blancosPresidente,
        form.nulosPresidente,
        form.blancosDiputado,
        form.nulosDiputado,
    ]);



    const handleChange = async (e) => {
        const { name, value, files, dataset, type, checked } = e.target;

        const camposNumericos = [
            'blancosPresidente',
            'blancosDiputado',
            'nulosPresidente',
            'nulosDiputado',
            'papeletasAnfora',
            'papeletasNoUtilizadas',
        ];

        const esNumeroValido = (val) => val === '' || (/^\d{1,3}$/.test(val) && Number(val) >= 0);

        if (name === 'estado' && type === 'checkbox') {
            if (checked) {
                const confirmacion = await Swal.fire({
                    title: '¿Estás seguro?',
                    text: '¿Deseas marcar esta boleta como OBSERVADA?',
                    icon: 'warning',
                    showCancelButton: true,
                    confirmButtonText: 'Sí, marcar',
                    cancelButtonText: 'Cancelar',
                });

                if (confirmacion.isConfirmed) {
                    setForm(prev => ({ ...prev, estado: 'observado' }));
                } else {
                    setForm(prev => ({ ...prev, estado: '' }));
                }
            } else {
                setForm(prev => ({ ...prev, estado: '' }));
            }
            return;
        }

        if (dataset?.tipo === 'presidente') {
            if (esNumeroValido(value)) {
                setForm(prev => ({
                    ...prev,
                    votosPresidente: {
                        ...prev.votosPresidente,
                        [name]: value,
                    },
                }));
            }
            return;
        }

        if (dataset?.tipo === 'diputado') {
            if (esNumeroValido(value)) {
                setForm(prev => ({
                    ...prev,
                    votosDiputado: {
                        ...prev.votosDiputado,
                        [name]: value,
                    },
                }));
            }
            return;
        }

        if (name === 'imagenActa' || name === 'imagenHojaTrabajo') {
            const file = files[0];
            if (file) {
                const sizeMB = (file.size / (1024 * 1024)).toFixed(2);
                await Swal.fire({
                    icon: 'info',
                    title: `Archivo seleccionado`,
                    text: `Tamaño del archivo (${name === 'imagenActa' ? 'Acta' : 'Hoja de Trabajo'}): ${sizeMB} MB`,
                    timer: 1800,
                    showConfirmButton: false,
                });

                setForm(prev => ({ ...prev, [name]: file }));

                const reader = new FileReader();
                reader.onloadend = () => {
                    if (name === 'imagenActa') setPreviewActa(reader.result);
                    else setPreviewHoja(reader.result);
                };
                reader.readAsDataURL(file);
            }
            return;
        }

        if (camposNumericos.includes(name)) {
            if (esNumeroValido(value)) {
                setForm(prev => {
                    const nuevoForm = { ...prev, [name]: value };

                    const papeletasPresidente =
                        (parseInt(nuevoForm.validosPresidente) || 0) +
                        (parseInt(nuevoForm.blancosPresidente) || 0) +
                        (parseInt(nuevoForm.nulosPresidente) || 0);

                    const papeletasDiputado =
                        (parseInt(nuevoForm.validosDiputado) || 0) +
                        (parseInt(nuevoForm.blancosDiputado) || 0) +
                        (parseInt(nuevoForm.nulosDiputado) || 0);

                    const maxPapeletas = Math.max(papeletasPresidente, papeletasDiputado);
                    nuevoForm.papeletasAnfora = maxPapeletas.toString();

                    advertirSiInconsistente('Presidente', papeletasPresidente, maxPapeletas);
                    advertirSiInconsistente('Diputado', papeletasDiputado, maxPapeletas);

                    marcarInputError('validosPresidente', papeletasPresidente > maxPapeletas);
                    marcarInputError('blancosPresidente', papeletasPresidente > maxPapeletas);
                    marcarInputError('nulosPresidente', papeletasPresidente > maxPapeletas);

                    marcarInputError('validosDiputado', papeletasDiputado > maxPapeletas);
                    marcarInputError('blancosDiputado', papeletasDiputado > maxPapeletas);
                    marcarInputError('nulosDiputado', papeletasDiputado > maxPapeletas);

                    marcarInputError('papeletasAnfora', false);

                    return nuevoForm;
                });
            }
            return;
        }

        if (['departamento', 'circunscripcion', 'provincia', 'municipio', 'recinto'].includes(name)) {
            setForm(prev => {
                const nuevoForm = { ...prev, [name]: value };

                switch (name) {
                    case 'departamento':
                        nuevoForm.circunscripcion = '';
                        nuevoForm.provincia = '';
                        nuevoForm.municipio = '';
                        nuevoForm.recinto = '';
                        nuevoForm.nroMesa = '';
                        break;
                    case 'circunscripcion':
                        nuevoForm.provincia = '';
                        nuevoForm.municipio = '';
                        nuevoForm.recinto = '';
                        nuevoForm.nroMesa = '';
                        break;
                    case 'provincia':
                        nuevoForm.municipio = '';
                        nuevoForm.recinto = '';
                        nuevoForm.nroMesa = '';
                        break;
                    case 'municipio':
                        nuevoForm.recinto = '';
                        nuevoForm.nroMesa = '';
                        break;
                    case 'recinto':
                        nuevoForm.nroMesa = '';
                        break;
                }

                return nuevoForm;
            });
            return;
        }

        setForm(prev => ({ ...prev, [name]: value }));
    };



    /*
    // 👇 antiguo protocolo de carga de datos los filtros
    // useEffect para cargar circunscripciones dependientes del departamento seleccionado
    useEffect(() => {
        if (!form.departamento) return; // Si no hay departamento seleccionado, no hacer nada

        const cargar = async () => {
            setLoading(true); // Indicar carga en progreso
            // Consulta filtrando circunscripciones por departamento seleccionado
            const q = query(collection(db, 'circunscripciones'), where('idDepartamento', '==', form.departamento));
            const snap = await getDocs(q);
            setCircunscripciones(snap.docs.map(doc => ({ id: doc.id, ...doc.data() }))); // Actualizar estado
            setLoading(false); // Fin de carga
        };

        cargar(); // Ejecutar la función de carga
    }, [form.departamento]); // Se ejecuta cada vez que cambia el departamento


    // useEffect para cargar provincias según circunscripción seleccionada
    useEffect(() => {
        if (!form.circunscripcion) return;

        const cargar = async () => {
            setLoading(true);
            // Consulta filtrando provincias por circunscripción seleccionada
            const q = query(collection(db, 'provincias'), where('idCircunscripcion', '==', form.circunscripcion));
            const snap = await getDocs(q);
            setProvincias(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
            setLoading(false);
        };

        cargar();
    }, [form.circunscripcion]); // Se ejecuta al cambiar la circunscripción


    // useEffect para cargar municipios según provincia seleccionada
    useEffect(() => {
        if (!form.provincia) return;

        const cargar = async () => {
            setLoading(true);
            // Consulta filtrando municipios por provincia seleccionada
            const q = query(collection(db, 'municipios'), where('idProvincia', '==', form.provincia));
            const snap = await getDocs(q);
            setMunicipios(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
            setLoading(false);
        };

        cargar();
    }, [form.provincia]); // Se ejecuta al cambiar la provincia


    // useEffect para cargar recintos (sin filtro, todos)
    useEffect(() => {
        const cargar = async () => {
            setLoading(true);
            const q = query(collection(db, 'recintos')); // Trae todos los recintos
            const snap = await getDocs(q);
            setRecintos(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
            setLoading(false);
        };

        cargar(); // Se ejecuta una vez al montar el componente
    }, []);

    */


    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!form.imagenActa || !form.imagenHojaTrabajo) {
            await Swal.fire({
                icon: 'warning',
                title: 'Archivos requeridos',
                text: 'Debes subir el acta y la hoja de trabajo.',
                confirmButtonColor: '#d33',
            });
            return;
        }

        if (!form.nroMesa) {
            await Swal.fire({
                icon: 'warning',
                title: 'Número de mesa requerido',
                text: 'Debes seleccionar el número de mesa.',
                confirmButtonColor: '#d33',
            });
            return;
        }

        const archivos = [
            { archivo: form.imagenActa, nombre: 'Acta' },
            { archivo: form.imagenHojaTrabajo, nombre: 'Hoja de Trabajo' },
        ];
        const MAX_TAMANO_MB = 6;
        for (const { archivo, nombre } of archivos) {
            const tamanoMB = archivo.size / (1024 * 1024);
            if (tamanoMB > MAX_TAMANO_MB) {
                await Swal.fire({
                    icon: 'warning',
                    title: `Archivo demasiado grande`,
                    text: `El archivo de ${nombre} no debe superar los ${MAX_TAMANO_MB} MB.`,
                    confirmButtonColor: '#d33',
                });
                return;
            }
        }

        try {
            setSubmitting(true);

            const user = auth.currentUser;
            if (!user) throw new Error('Usuario no autenticado');

            const userDocRef = doc(db, 'usuarios', user.uid);
            const userSnap = await getDoc(userDocRef);
            if (!userSnap.exists()) throw new Error('Usuario no encontrado');

            const userData = userSnap.data();

            // Determinar recinto a usar según rol
            const recintoParaGuardar = (userData.rol === 'administrador' || userData.rol === 'revisor')
                ? form.recinto
                : userData.recintoId;

            if (!recintoParaGuardar) throw new Error('Recinto es indefinido');

            // Validar si ya existe boleta para ese recinto y mesa
            const q = query(
                collection(db, 'recepcion'),
                where('recinto', '==', recintoParaGuardar),
                where('nroMesa', '==', form.nroMesa)
            );
            const snap = await getDocs(q);

            if (!snap.empty) {
                await Swal.fire({
                    icon: 'warning',
                    title: 'Número de mesa duplicado',
                    text: `Ya se ha registrado una boleta con el número de mesa ${form.nroMesa} en el recinto seleccionado.`,
                    confirmButtonColor: '#d33',
                });
                return;
            }

            // Subir imágenes
            const refActa = ref(storage, `actas/${form.nroMesa}_${Date.now()}`);
            await uploadBytes(refActa, form.imagenActa);
            const urlActa = await getDownloadURL(refActa);

            const refHoja = ref(storage, `hojas_trabajo/${form.nroMesa}_${Date.now()}`);
            await uploadBytes(refHoja, form.imagenHojaTrabajo);
            const urlHoja = await getDownloadURL(refHoja);

            // Obtener campo dat del recinto
            const recintoDocRef = doc(db, 'recintos', recintoParaGuardar);
            const recintoSnap = await getDoc(recintoDocRef);
            let datRecinto = null;
            if (recintoSnap.exists()) {
                datRecinto = recintoSnap.data().dat;
            } else {
                console.warn('Recinto no encontrado al intentar obtener dat');
            }

            // Preparar datos para guardar
            const { imagenActa, imagenHojaTrabajo, ...formSinImagenes } = form;

            await addDoc(collection(db, 'recepcion'), {
                ...formSinImagenes,
                recinto: recintoParaGuardar,
                dat: datRecinto, // <-- aquí se guarda dat
                imagenActaUrl: urlActa,
                imagenHojaTrabajoUrl: urlHoja,
                creadoEn: serverTimestamp(),
                idUsuarioRecepcion: user.uid,
                estado: 'pendiente',
            });

            await Swal.fire({
                icon: 'success',
                title: 'Registro exitoso',
                text: 'El Acta fue enviada correctamente.',
                confirmButtonColor: '#0a58ca',
            });

            // Limpiar formulario
            setForm({
                recinto: (userData.rol === 'administrador' || userData.rol === 'revisor') ? '' : recintoParaGuardar,
                nroMesa: '',
                votosPresidente: {},
                votosDiputado: {},
                validosPresidente: '',
                validosDiputado: '',
                blancosPresidente: '',
                blancosDiputado: '',
                nulosPresidente: '',
                nulosDiputado: '',
                papeletasAnfora: '',
                papeletasNoUtilizadas: '',
                imagenActa: null,
                imagenHojaTrabajo: null,
            });
            setPreviewActa(null);
            setPreviewHoja(null);

        } catch (err) {
            await Swal.fire({
                icon: 'error',
                title: 'Error al enviar',
                text: 'Ocurrió un problema al registrar el acta. Intenta nuevamente.',
                confirmButtonColor: '#d33',
            });
            console.error(err);
        } finally {
            setSubmitting(false);
        }
    };



    const RecorteBotones = ({ aplicarRecorte, cancelarRecorte }) => {
        return (
            <>
                <motion.button
                    className={`${styles.botonRecorte} ${styles.botonAplicar}`}
                    onClick={aplicarRecorte}
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 30 }}
                    transition={{ duration: 0.4 }}
                    type="button"
                >
                    ✅ Aplicar
                </motion.button>

                <motion.button
                    className={`${styles.botonRecorte} ${styles.botonCancelar}`}
                    onClick={cancelarRecorte}
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 30 }}
                    transition={{ duration: 0.4 }}
                    type="button"
                >
                    ❌ Cancelar
                </motion.button>
            </>
        );
    };



    return (
        <div className={styles['select-group']}>
            <h2>Registro de Acta Electoral</h2>

            <form onSubmit={handleSubmit} className={styles.form}>
                {/* 📸 Subir imágenes */}
                <PasoIndicador
                    numero={1}
                    texto="Sube las imágenes del Acta y Hoja de trabajo"
                    ayuda="Puedes usar la cámara o seleccionar desde galería. Asegúrate de que la foto esté legible y bien encuadrada para facilitar la verificación."
                />
                {/* ===== Foto del Acta ===== */}
                <div>
                    <label>Foto del Acta:</label>
                    <div className={styles.selectorContainer}>
                        {/* Botón para tomar con cámara */}
                        <label className={styles.iconButton}>
                            📷 Cámara
                            <input
                                type="file"
                                accept="image/*"
                                capture="environment"
                                onChange={(e) => handlePreview(e, 'acta')}
                                style={{ display: 'none' }}
                            />
                        </label>

                        {/* Botón para seleccionar de galería */}
                        <label className={styles.iconButton}>
                            🖼️ Galería
                            <input
                                type="file"
                                accept="image/*"
                                onChange={(e) => handlePreview(e, 'acta')}
                                style={{ display: 'none' }}
                            />
                        </label>
                    </div>

                    <AnimatePresence>
                        {previewActa && !recortandoTipo && (
                            <motion.div
                                key="previewActa"
                                initial={{ opacity: 0, scale: 0.8 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.8 }}
                                transition={{ duration: 0.3 }}
                            >
                                <img
                                    src={previewActa}
                                    alt="Vista previa acta"
                                    className={styles.imagenPreview}
                                />
                                <br />
                                <p>Tamaño: {sizeActa} MB</p>
                                <button
                                    type="button"
                                    onClick={() => iniciarRecorte('acta')}
                                    style={{ marginTop: 5 }}
                                >
                                    ✂️ Recortar Acta
                                </button>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                {/* ===== Foto de la Hoja de Trabajo ===== */}
                <div>
                    <label>Foto de la Hoja de Trabajo:</label>
                    <div className={styles.selectorContainer}>
                        {/* Botón para tomar con cámara */}
                        <label className={styles.iconButton}>
                            📷 Cámara
                            <input
                                type="file"
                                accept="image/*"
                                capture="environment"
                                onChange={(e) => handlePreview(e, 'hoja')}
                                style={{ display: 'none' }}
                            />
                        </label>

                        {/* Botón para seleccionar de galería */}
                        <label className={styles.iconButton}>
                            🖼️ Galería
                            <input
                                type="file"
                                accept="image/*"
                                onChange={(e) => handlePreview(e, 'hoja')}
                                style={{ display: 'none' }}
                            />
                        </label>
                    </div>

                    <AnimatePresence>
                        {previewHoja && !recortandoTipo && (
                            <motion.div
                                key="previewHoja"
                                initial={{ opacity: 0, scale: 0.8 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.8 }}
                                transition={{ duration: 0.3 }}
                            >
                                <img
                                    src={previewHoja}
                                    alt="Vista previa hoja"
                                    className={styles.imagenPreview}
                                />
                                <br />
                                <p>Tamaño: {sizeHoja} MB</p>
                                <button
                                    type="button"
                                    onClick={() => iniciarRecorte('hoja')}
                                    style={{ marginTop: 5 }}
                                >
                                    ✂️ Recortar Hoja
                                </button>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                {/* Recorte */}
                {recortandoTipo && (
                    <div
                        style={{
                            position: 'relative',
                            width: '100%',
                            height: 300,
                            marginBottom: 20,
                        }}
                    >
                        <Cropper
                            image={
                                recortandoTipo === 'acta' ? imagenActaSrc : imagenHojaSrc
                            }
                            crop={crop}
                            zoom={zoom}
                            aspect={4 / 2}
                            onCropChange={setCrop}           // ← Esto permite mover el cuadro
                            onZoomChange={setZoom}           // ← Esto permite hacer zoom
                            onCropComplete={onCropComplete}  // ← Guarda coordenadas finales
                        />

                        <RecorteBotones
                            aplicarRecorte={aplicarRecorte}
                            cancelarRecorte={() => setRecortandoTipo(null)}
                        />
                    </div>
                )}


                {/* Información del recinto y ubicación asignada al usuario */}
                <PasoIndicador
                    numero={2}
                    texto="Confirma los datos automáticos del usuario"
                    ayuda="Los campos Departamento, Circunscripción, Provincia, Municipio y Recinto se completan automáticamente según tu perfil."
                />
                {userData && (
                    <div className={styles.columnas}>
                        {userData.rol === 'administrador' || userData.rol === 'revisor' ? (
                            <>
                                <label>
                                    Departamento:
                                    <select
                                        name="departamento"
                                        value={form.departamento}
                                        onChange={handleChange}
                                        required
                                    >
                                        <option value="">-- Selecciona un departamento --</option>
                                        {departamentos.map(d => (
                                            <option key={d.id} value={d.id}>{d.nombre}</option>
                                        ))}
                                    </select>
                                </label>

                                <label>
                                    Circunscripción:
                                    <select
                                        name="circunscripcion"
                                        value={form.circunscripcion}
                                        onChange={handleChange}
                                        required
                                        disabled={!form.departamento}
                                    >
                                        <option value="">-- Selecciona una circunscripción --</option>
                                        {circunscripciones.map(c => (
                                            <option key={c.id} value={c.id}>{c.nombre}</option>
                                        ))}
                                    </select>
                                </label>

                                <label>
                                    Provincia:
                                    <select
                                        name="provincia"
                                        value={form.provincia}
                                        onChange={handleChange}
                                        required
                                        disabled={!form.circunscripcion}
                                    >
                                        <option value="">-- Selecciona una provincia --</option>
                                        {provincias.map(p => (
                                            <option key={p.id} value={p.id}>{p.nombre}</option>
                                        ))}
                                    </select>
                                </label>

                                <label>
                                    Municipio:
                                    <select
                                        name="municipio"
                                        value={form.municipio}
                                        onChange={handleChange}
                                        required
                                        disabled={!form.provincia}
                                    >
                                        <option value="">-- Selecciona un municipio --</option>
                                        {municipios.map(m => (
                                            <option key={m.id} value={m.id}>{m.nombre}</option>
                                        ))}
                                    </select>
                                </label>

                                <label>
                                    Recinto:
                                    <select
                                        name="recinto"
                                        value={form.recinto}
                                        onChange={handleChange}
                                        required
                                        disabled={!form.municipio}
                                    >
                                        <option value="">-- Selecciona un recinto --</option>
                                        {recintos.map(r => (
                                            <option key={r.id} value={r.id}>{r.nombre}</option>
                                        ))}
                                    </select>
                                </label>

                                <label>
                                    Número de Mesa:
                                    <select
                                        name="nroMesa"
                                        value={form.nroMesa}
                                        onChange={handleChange}
                                        required
                                        disabled={!form.recinto}
                                    >
                                        <option value="">-- Selecciona una mesa --</option>
                                        {mesasDisponibles.map(mesa => (
                                            <option key={mesa.id} value={mesa.codigo}>
                                                Mesa {mesa.codigo}
                                            </option>
                                        ))}
                                    </select>
                                </label>
                            </>
                        ) : (
                            // Para operador: campos fijos, sin editar
                            <>
                                <label>
                                    Departamento:
                                    <input type="text" value={userData.departamentoNombre} disabled />
                                    <input type="hidden" name="departamento" value={userData.departamentoId} />
                                </label>

                                <label>
                                    Circunscripción:
                                    <input type="text" value={userData.circunscripcionNombre} disabled />
                                    <input type="hidden" name="circunscripcion" value={userData.circunscripcionId} />
                                </label>

                                <label>
                                    Provincia:
                                    <input type="text" value={userData.provinciaNombre} disabled />
                                    <input type="hidden" name="provincia" value={userData.provinciaId} />
                                </label>

                                <label>
                                    Municipio:
                                    <input type="text" value={userData.municipioNombre} disabled />
                                    <input type="hidden" name="municipio" value={userData.municipioId} />
                                </label>

                                <label>
                                    Recinto:
                                    <input type="text" value={userData.recintoNombre} disabled />
                                    <input type="hidden" name="recinto" value={userData.recintoId} />
                                </label>

                                <label>
                                    Número de Mesa:
                                    <select
                                        name="nroMesa"
                                        value={form.nroMesa}
                                        onChange={handleChange}
                                        required
                                    >
                                        <option value="">-- Selecciona una mesa --</option>
                                        {mesasDisponibles.map(mesa => (
                                            <option key={mesa.id} value={mesa.codigo}>
                                                Mesa {mesa.codigo}
                                            </option>
                                        ))}
                                    </select>
                                </label>
                            </>
                        )}
                    </div>
                )}

                {/* Tabla de votos por partido */}

                <div className={styles.tablaVotos}>
                    <PasoIndicador
                        numero={3}
                        texto="Registra los votos de Presidente y Diputados Uninominales"
                        ayuda="Ingresa los votos en las columnas correspondientes. Solo se permiten números positivos y el sistema calcula automáticamente los totales para apoyo visual."
                    />
                    <table>
                        <thead>
                            <tr>
                                <th>Partido</th>
                                <th>Presidente</th>
                                <th>Diputado</th>
                            </tr>
                        </thead>
                        <tbody>
                            {partidos.map((p) => (
                                <tr key={p}>
                                    <td>{p}</td>
                                    <td>
                                        <input
                                            type="number"
                                            name={p}
                                            value={form.votosPresidente[p] || ''}
                                            onChange={handleChange}
                                            data-tipo="presidente"
                                        />
                                    </td>
                                    <td>
                                        <input
                                            type="number"
                                            name={p}
                                            value={form.votosDiputado[p] || ''}
                                            onChange={handleChange}
                                            data-tipo="diputado"
                                        />
                                    </td>
                                </tr>
                            ))}


                        </tbody>
                    </table>
                </div>


                {/* Totales */}
                <PasoIndicador
                    numero={4}
                    texto="Completa los campos adicionales sobre papeletas"
                    ayuda="Registra la cantidad de papeletas válidas, blancas, nulas, utilizadas y no utilizadas para mantener el control del material electoral."
                />
                <div className={styles.totales}>
                    <label>
                        Válidos Presidente:
                        <div style={{ fontWeight: 'bold', padding: '0.4rem 0' }}>
                            {
                                Object.values(form.votosPresidente || {}).reduce((acc, val) => acc + (parseInt(val) || 0), 0)
                            }
                        </div>
                    </label>
                    <label>
                        Válidos Diputado:
                        <div style={{ fontWeight: 'bold', padding: '0.4rem 0' }}>
                            {
                                Object.values(form.votosDiputado || {}).reduce((acc, val) => acc + (parseInt(val) || 0), 0)
                            }
                        </div>
                    </label>
                    <label>Blancos Presidente:
                        <input name="blancosPresidente" type="number" value={form.blancosPresidente} onChange={handleChange} required />
                    </label>
                    <label>Blancos Diputado:
                        <input name="blancosDiputado" type="number" value={form.blancosDiputado} onChange={handleChange} required />
                    </label>
                    <label>Nulos Presidente:
                        <input name="nulosPresidente" type="number" value={form.nulosPresidente} onChange={handleChange} required />
                    </label>
                    <label>Nulos Diputado:
                        <input name="nulosDiputado" type="number" value={form.nulosDiputado} onChange={handleChange} required />
                    </label>
                </div>

                <PasoIndicador
                    numero={5}
                    texto="Completa los campos de papeletas en anfora y no utilizadas"
                    ayuda="suele estar en la columna izquierda del Acta"
                />
                <div className={styles.totales}>
                    <label>Papeletas en ánfora:
                        <input name="papeletasAnfora" type="number" value={form.papeletasAnfora} onChange={handleChange} required />
                    </label>
                    <label>Papeletas no utilizadas:
                        <input name="papeletasNoUtilizadas" type="number" value={form.papeletasNoUtilizadas} onChange={handleChange} required />
                    </label>
                    <div style={{ marginTop: '2rem' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <input
                                type="checkbox"
                                name="estado"
                                checked={form.estado === 'observado'}
                                onChange={handleChange}
                            />
                            Marcar como <strong>observado</strong>
                        </label>
                    </div>
                </div>
                {/* Botón de envío */}
                <button
                    type="submit"
                    className={styles.btn}
                    disabled={submitting}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                    {submitting ? <ClipLoader size={20} color="#fff" /> : 'Registrar Boleta'}
                </button>

            </form>

            {/*console.log('📋 Datos de boletas:', misBoletas)*/}
            {
                misBoletas.length > 0 && (
                    <>
                        {/*console.log('🔍 Total de boletas cargadas:', misBoletas.length)*/}
                        {/*console.log('📋 Datos de boletas:', misBoletas)*/}

                        <div className={styles.seccionBoletas}>
                            <h3 style={{ marginTop: '2rem' }}>Registros Enviados</h3>
                            <div className={styles.boletasGrid}>
                                {misBoletas.map((b) => {
                                    {/*console.log(`🧾 Mesa ${b.nroMesa}:`, b);*/ }
                                    return (
                                        <div key={b.id} className={styles.boletaItem}>
                                            <div className={styles.boletaBarra}>
                                                <span className={styles.nroMesa}>Mesa {b.nroMesa}</span>
                                                {b.estado === 'pendiente' && (
                                                    <span className={styles.checkIcon}>✔️</span>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </>
                )
            }


        </div >
    );

}


