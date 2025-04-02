import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head } from '@inertiajs/react';
import { useEffect, useRef } from 'react';

const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Dashboard',
        href: '/dashboard',
    },
];

export default function Dashboard() {
    const videoRef = useRef<HTMLVideoElement | null>(null);

    useEffect(() => {
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
            navigator.mediaDevices
                .getUserMedia({ video: true })
                .then((stream: MediaStream) => {
                    if (videoRef.current) {
                        videoRef.current.srcObject = stream;
                    }
                })
                .catch((error: Error) => {
                    console.error('Error accessing the camera: ', error);
                });
        } else {
            console.log('getUserMedia is not supported in this browser.');
        }

        return () => {
            if (videoRef.current && videoRef.current.srcObject) {
                // eslint-disable-next-line react-hooks/exhaustive-deps
                const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
                tracks.forEach((track) => track.stop());
            }
        };
    }, []);

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Dashboard" />
            <div className="flex h-full flex-1 flex-col gap-4 rounded-xl p-4">
                <div>
                    <h1>Live Camera Stream</h1>
                    <video ref={videoRef} autoPlay />
                </div>
            </div>
        </AppLayout>
    );
}
