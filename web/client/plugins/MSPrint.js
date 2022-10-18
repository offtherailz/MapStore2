import React, {useState} from 'react';
import {Button, ProgressBar} from 'react-bootstrap';
import Dialog from '../components/misc/Dialog';

import {createPlugin} from "../utils/PluginsUtils";
import { queuePrint, getJobStatus} from '@camptocamp/inkmap';

import Portal from '../components/misc/Portal';

export const name = "MSPrint";

const Component = () => {
    const [jobs, setJobs] = useState({});
    return (
        <Portal>
            <Dialog id="print-dialog" >
                <div role="body">
                    {Object.keys(jobs).map((jobId) => {
                        return (
                            <div key={jobId}>
                                <div>{jobId}</div>
                                <div>{jobs[jobId].status}</div>
                                <ProgressBar now={jobs[jobId].progress * 100} />
                            </div>
                        );
                    })
                    }
                    <Button  onClick={ () => {
                        const spec = {
                            layers: [{
                                type: "XYZ",
                                url: "https://{a-c}.tile.openstreetmap.org/{z}/{x}/{y}.png",
                                attribution: "© OpenStreetMap contributors"
                            }, {
                                type: "WMS",
                                url: "https://gs-stable.geo-solutions.it/geoserver/wms",
                                layer: "gs:us_states",
                                tiled: true
                            }, {
                                type: "WFS",
                                url: "https://gs-stable.geo-solutions.it/geoserver/wms",
                                layer: "gs:us_states",
                                format: 'geojson',
                                tiled: true
                            }],
                            size: [1500, 1500],
                            center: [-103, 40],
                            dpi: 300,
                            scale: 50000000,
                            projection: 'EPSG:4326'

                        };
                        queuePrint(spec).then((jobId) => {
                            setJobs(jj => ({...jj, [jobId]: {status: "queued"}}));
                            getJobStatus(jobId).subscribe((status) => {
                                setJobs( jj => ({...jj, [jobId]: status}));
                                if (status.status === "finished") {

                                    const blob = status.imageBlob;
                                    const url = URL.createObjectURL(blob);
                                    const a = document.createElement('a');
                                    a.href = url;
                                    a.download = "map.jpg";
                                    a.click();

                                    setJobs(jj => {
                                        const newJobs = {...jj};
                                        delete newJobs[jobId];
                                        return newJobs;
                                    });
                                }
                            });
                        });
                    }}>Print</Button>
                </div>
            </Dialog>
        </Portal>
    );
};

export default createPlugin(name, {
    component: Component
});
